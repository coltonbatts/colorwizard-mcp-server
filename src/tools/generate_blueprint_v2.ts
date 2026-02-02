/**
 * Instrument CW-08: Blueprint Generation v2
 * Quantizes an image into N perceptual colors (Lab), extracts region contours,
 * returns palette + per-region contours (polylines in pixel coordinates)
 */

import sharp from "sharp";
import { rgbToLab, deltaE76, type RGB, type Lab } from "../lib/color/lab.js";
import { matchDmcHandler, type MatchDmcOutput } from "./match_dmc.js";
import { getCachedImage, generateCacheKey, extractBase64, type CachedImage } from "./sample_color.js";
import { SeededRNG } from "../lib/rng.js";
import { generateBlueprintV1Handler, type GenerateBlueprintV1Input } from "./generate_blueprint_v1.js";

export interface GenerateBlueprintV2Input {
    imageId?: string; // Image ID from image_register (alternative to imageBase64)
    imageBase64?: string; // Base64-encoded image data (alternative to imageId)
    paletteSize: number; // Number of colors to quantize to
    maxSize?: number; // Default 2048 (only used when imageBase64 is provided)
    seed?: number; // Optional seed for deterministic output (default: 42)
    returnPreview?: boolean; // If true, return indexedPreviewPngBase64 (default: false)
    minRegionArea?: number; // Minimum region area in pixels (default: 0, meaning off)
    mergeSmallRegions?: boolean; // If true, merge regions smaller than minRegionArea (default: false unless minRegionArea > 0)
}

export interface PaletteColor {
    rgb: RGB;
    hex: string;
    lab: Lab;
    count: number;
    percent: number;
    dmcMatch: {
        ok: boolean;
        best?: MatchDmcOutput["best"];
        alternatives?: MatchDmcOutput["alternatives"];
        method?: string;
    };
}

export interface Region {
    labelIndex: number; // Cluster index (palette color index)
    areaPx: number; // Number of pixels in this region
    bbox: {
        x0: number; // Minimum x coordinate
        y0: number; // Minimum y coordinate
        x1: number; // Maximum x coordinate (exclusive)
        y1: number; // Maximum y coordinate (exclusive)
    };
    contours: Array<Array<{ x: number; y: number }>>; // Polylines in image pixel coordinates
}

export interface GenerateBlueprintV2Output {
    ok: boolean;
    width?: number;
    height?: number;
    palette?: PaletteColor[];
    regions?: Region[];
    indexedPreviewPngBase64?: string; // Base64-encoded PNG preview (quantized image)
    method?: string;
    error?: string;
}

/**
 * Converts RGB to hex string
 */
function rgbToHex(rgb: RGB): string {
    return `#${[rgb.r, rgb.g, rgb.b]
        .map((val) => Math.max(0, Math.min(255, val)).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()}`;
}

/**
 * Region structure for connected-components analysis
 */
interface InternalRegion {
    id: number;
    clusterIndex: number;
    pixelIndices: number[];
    neighborRegions: Set<number>;
}

/**
 * Connected-components labeling (4-connected) per cluster label
 * Returns array of regions and a label map (regionId -> clusterIndex)
 */
function extractRegions(
    width: number,
    height: number,
    clusterLabels: number[]
): { regions: InternalRegion[]; regionLabelMap: Int32Array } {
    const regionLabels = new Int32Array(width * height).fill(-1);
    let regionCount = 0;
    const regions: InternalRegion[] = [];

    const getClusterLabel = (x: number, y: number) => clusterLabels[y * width + x];
    const getRegionId = (x: number, y: number) => regionLabels[y * width + x];

    // First pass: label connected components
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (getRegionId(x, y) !== -1) continue;

            const clusterIdx = getClusterLabel(x, y);
            const currentRegionId = regionCount++;
            const pixelIndices: number[] = [];
            const queue: [number, number][] = [[x, y]];

            regionLabels[y * width + x] = currentRegionId;

            // Flood fill with 4-connectivity
            while (queue.length > 0) {
                const [cx, cy] = queue.shift()!;
                pixelIndices.push(cy * width + cx);

                // 4-connected neighbors
                const neighbors: [number, number][] = [
                    [cx + 1, cy],
                    [cx - 1, cy],
                    [cx, cy + 1],
                    [cx, cy - 1],
                ];

                for (const [nx, ny] of neighbors) {
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        if (getRegionId(nx, ny) === -1 && getClusterLabel(nx, ny) === clusterIdx) {
                            regionLabels[ny * width + nx] = currentRegionId;
                            queue.push([nx, ny]);
                        }
                    }
                }
            }

            regions.push({
                id: currentRegionId,
                clusterIndex: clusterIdx,
                pixelIndices,
                neighborRegions: new Set(),
            });
        }
    }

    // Second pass: identify neighboring regions
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const r1 = getRegionId(x, y);
            // Check right and bottom neighbors (avoid duplicates)
            const checkNeighbors: [number, number][] = [
                [x + 1, y],
                [x, y + 1],
            ];
            for (const [nx, ny] of checkNeighbors) {
                if (nx < width && ny < height) {
                    const r2 = getRegionId(nx, ny);
                    if (r1 !== r2 && r1 !== -1 && r2 !== -1) {
                        regions[r1].neighborRegions.add(r2);
                        regions[r2].neighborRegions.add(r1);
                    }
                }
            }
        }
    }

    return { regions, regionLabelMap: regionLabels };
}

/**
 * Merges small regions into neighboring regions
 * Uses majority adjacency by default, or smallest deltaE if useDeltaE is true
 */
function mergeSmallRegions(
    width: number,
    height: number,
    regions: InternalRegion[],
    minArea: number,
    clusterLabels: number[],
    labPixels: Lab[],
    useDeltaE: boolean = false
): number[] {
    const updatedLabels = [...clusterLabels];
    let changed = true;

    while (changed) {
        changed = false;
        const smallRegionIndex = regions.findIndex(
            (r) => r.pixelIndices.length > 0 && r.pixelIndices.length < minArea
        );

        if (smallRegionIndex === -1) break;

        const smallRegion = regions[smallRegionIndex];
        if (smallRegion.neighborRegions.size === 0) {
            // Isolated region, can't merge - mark as processed by clearing pixels
            smallRegion.pixelIndices = [];
            continue;
        }

        let bestCluster: number | null = null;

        if (useDeltaE) {
            // Method: smallest deltaE to region mean
            // Compute mean Lab color of small region
            const regionLabSum = { l: 0, a: 0, b: 0 };
            smallRegion.pixelIndices.forEach((pixelIdx) => {
                const lab = labPixels[pixelIdx];
                regionLabSum.l += lab.l;
                regionLabSum.a += lab.a;
                regionLabSum.b += lab.b;
            });
            const regionArea = smallRegion.pixelIndices.length;
            const regionMeanLab: Lab = {
                l: regionLabSum.l / regionArea,
                a: regionLabSum.a / regionArea,
                b: regionLabSum.b / regionArea,
            };

            // Find neighbor cluster with smallest deltaE
            const neighborClusters = new Map<number, Lab[]>();
            smallRegion.neighborRegions.forEach((neighborId) => {
                const neighbor = regions[neighborId];
                if (neighbor.pixelIndices.length > 0) {
                    const clusterIdx = neighbor.clusterIndex;
                    if (!neighborClusters.has(clusterIdx)) {
                        neighborClusters.set(clusterIdx, []);
                    }
                    // Collect all pixels from this neighbor cluster
                    neighbor.pixelIndices.forEach((pixelIdx) => {
                        neighborClusters.get(clusterIdx)!.push(labPixels[pixelIdx]);
                    });
                }
            });

            let minDeltaE = Infinity;
            neighborClusters.forEach((pixelLabs, clusterIdx) => {
                // Compute mean Lab of neighbor cluster
                const neighborLabSum = { l: 0, a: 0, b: 0 };
                pixelLabs.forEach((lab) => {
                    neighborLabSum.l += lab.l;
                    neighborLabSum.a += lab.a;
                    neighborLabSum.b += lab.b;
                });
                const neighborMeanLab: Lab = {
                    l: neighborLabSum.l / pixelLabs.length,
                    a: neighborLabSum.a / pixelLabs.length,
                    b: neighborLabSum.b / pixelLabs.length,
                };

                const deltaE = deltaE76(regionMeanLab, neighborMeanLab);
                if (deltaE < minDeltaE) {
                    minDeltaE = deltaE;
                    bestCluster = clusterIdx;
                }
            });
        } else {
            // Method: majority adjacency (simplest)
            const neighborClusters = new Map<number, number>();
            smallRegion.neighborRegions.forEach((neighborId) => {
                const neighbor = regions[neighborId];
                if (neighbor.pixelIndices.length > 0) {
                    const clusterIdx = neighbor.clusterIndex;
                    const count = neighborClusters.get(clusterIdx) || 0;
                    neighborClusters.set(clusterIdx, count + neighbor.pixelIndices.length);
                }
            });

            if (neighborClusters.size > 0) {
                let maxCount = -1;
                neighborClusters.forEach((count, clusterIdx) => {
                    if (count > maxCount) {
                        maxCount = count;
                        bestCluster = clusterIdx;
                    }
                });
            }
        }

        if (bestCluster !== null) {
            // Find a neighbor region with the best cluster
            const targetRegionId = Array.from(smallRegion.neighborRegions).find(
                (id) => regions[id].clusterIndex === bestCluster && regions[id].pixelIndices.length > 0
            );

            if (targetRegionId !== undefined) {
                const targetRegion = regions[targetRegionId];

                // Reassign pixels
                smallRegion.pixelIndices.forEach((pixelIdx) => {
                    updatedLabels[pixelIdx] = bestCluster!;
                });

                // Merge pixel indices into target region
                targetRegion.pixelIndices.push(...smallRegion.pixelIndices);

                // Update neighbor relationships
                smallRegion.neighborRegions.forEach((neighborId) => {
                    if (neighborId !== targetRegionId) {
                        regions[neighborId].neighborRegions.delete(smallRegion.id);
                        if (!regions[neighborId].neighborRegions.has(targetRegionId)) {
                            regions[neighborId].neighborRegions.add(targetRegionId);
                            targetRegion.neighborRegions.add(neighborId);
                        }
                    }
                });

                targetRegion.neighborRegions.delete(smallRegion.id);
                smallRegion.pixelIndices = [];
                changed = true;
            }
        } else {
            // No valid neighbor found, mark as processed
            smallRegion.pixelIndices = [];
        }
    }

    return updatedLabels;
}

/**
 * Simple k-means clustering in Lab color space
 * Uses seeded RNG for deterministic centroid initialization
 */
function quantizeLab(
    pixels: Lab[],
    k: number,
    rng: SeededRNG,
    maxIterations: number = 20
): { clusters: Lab[]; labels: number[] } {
    if (pixels.length === 0) return { clusters: [], labels: [] };
    if (k >= pixels.length) {
        return { clusters: pixels, labels: pixels.map((_, i) => i) };
    }
    if (k <= 0) {
        return { clusters: [], labels: [] };
    }

    // Initialize centroids deterministically using seeded RNG (pick unique pixels)
    let centroids: Lab[] = [];
    const usedIndices = new Set<number>();
    while (centroids.length < k && usedIndices.size < pixels.length) {
        const idx = rng.randomIntMax(pixels.length);
        if (!usedIndices.has(idx)) {
            centroids.push({ ...pixels[idx] });
            usedIndices.add(idx);
        }
    }

    // If we couldn't get enough unique centroids, pad with last centroid
    while (centroids.length < k) {
        centroids.push({ ...centroids[centroids.length - 1] });
    }

    let labels = new Array(pixels.length).fill(0);
    let converged = false;

    for (let iter = 0; iter < maxIterations && !converged; iter++) {
        // Assignment step: assign each pixel to nearest centroid
        const newLabels = pixels.map((pixel) => {
            let minDist = Infinity;
            let bestCluster = 0;
            centroids.forEach((centroid, i) => {
                const dist = deltaE76(pixel, centroid);
                if (dist < minDist) {
                    minDist = dist;
                    bestCluster = i;
                }
            });
            return bestCluster;
        });

        // Check convergence
        converged = newLabels.every((l, i) => l === labels[i]);
        labels = newLabels;

        if (converged) break;

        // Update step: recompute centroids as mean of assigned pixels
        const newCentroids: Lab[] = Array.from({ length: k }, () => ({ l: 0, a: 0, b: 0 }));
        const counts = new Array(k).fill(0);

        pixels.forEach((pixel, i) => {
            const label = labels[i];
            newCentroids[label].l += pixel.l;
            newCentroids[label].a += pixel.a;
            newCentroids[label].b += pixel.b;
            counts[label]++;
        });

        centroids = newCentroids.map((c, i) => {
            if (counts[i] === 0) return centroids[i]; // Keep old centroid if no pixels assigned
            return {
                l: c.l / counts[i],
                a: c.a / counts[i],
                b: c.b / counts[i],
            };
        });
    }

    return { clusters: centroids, labels };
}

/**
 * Extract contours from a region using border-following algorithm
 * Uses Moore neighborhood tracing to follow the outer boundary
 * Returns array of contours (polylines), where each contour is an array of {x, y} points
 */
function extractContours(
    width: number,
    height: number,
    regionLabelMap: Int32Array,
    regionId: number,
    pixelIndices: number[]
): Array<Array<{ x: number; y: number }>> {
    if (pixelIndices.length === 0) return [];

    const contours: Array<Array<{ x: number; y: number }>> = [];

    // Helper to check if a pixel is in the region
    const isInRegion = (x: number, y: number): boolean => {
        if (x < 0 || x >= width || y < 0 || y >= height) return false;
        return regionLabelMap[y * width + x] === regionId;
    };

    // Helper to check if a pixel is a border pixel (has at least one non-region neighbor)
    const isBorderPixel = (x: number, y: number): boolean => {
        if (!isInRegion(x, y)) return false;
        // Check 4-connected neighbors
        const neighbors = [
            [x + 1, y],
            [x - 1, y],
            [x, y + 1],
            [x, y - 1],
        ];
        return neighbors.some(([nx, ny]) => !isInRegion(nx, ny));
    };

    // Build a set of border pixels for quick lookup
    const borderPixelSet = new Set<string>();
    for (const pixelIdx of pixelIndices) {
        const x = pixelIdx % width;
        const y = Math.floor(pixelIdx / width);
        if (isBorderPixel(x, y)) {
            borderPixelSet.add(`${x},${y}`);
        }
    }

    if (borderPixelSet.size === 0) {
        // No border pixels (shouldn't happen for valid regions, but handle gracefully)
        return [];
    }

    // Extract contours by following borders
    const processed = new Set<string>();
    
    // Find starting border pixels (scan top-to-bottom, left-to-right for deterministic order)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const key = `${x},${y}`;
            if (!borderPixelSet.has(key) || processed.has(key)) continue;

            // Found an unprocessed border pixel, start tracing
            const contour: Array<{ x: number; y: number }> = [];
            let cx = x;
            let cy = y;
            const startX = x;
            const startY = y;
            
            // Moore neighborhood directions (8-connected, counter-clockwise from right)
            const directions = [
                [1, 0],   // right
                [1, -1],  // top-right
                [0, -1],  // top
                [-1, -1], // top-left
                [-1, 0],  // left
                [-1, 1],  // bottom-left
                [0, 1],   // bottom
                [1, 1],   // bottom-right
            ];

            // Find initial direction: find first direction pointing to a non-region pixel
            let dir = 0;
            for (let d = 0; d < 8; d++) {
                const [dx, dy] = directions[d];
                const nx = cx + dx;
                const ny = cy + dy;
                if (!isInRegion(nx, ny)) {
                    dir = d;
                    break;
                }
            }

            // Trace the border
            let iterations = 0;
            const maxIterations = width * height * 4; // Safety limit
            
            while (iterations < maxIterations) {
                iterations++;
                
                const currentKey = `${cx},${cy}`;
                if (iterations === 1) {
                    contour.push({ x: cx, y: cy });
                    processed.add(currentKey);
                }

                // Try to find next border pixel by checking neighbors counter-clockwise
                let found = false;
                for (let offset = 0; offset < 8; offset++) {
                    const checkDir = (dir + offset) % 8;
                    const [dx, dy] = directions[checkDir];
                    const nx = cx + dx;
                    const ny = cy + dy;
                    const nextKey = `${nx},${ny}`;

                    // Check if this neighbor is a border pixel
                    if (borderPixelSet.has(nextKey)) {
                        // Check if we've returned to start
                        if (nx === startX && ny === startY && contour.length > 1) {
                            // Close the contour
                            contour.push({ x: startX, y: startY });
                            found = true;
                            break;
                        }
                        
                        if (!processed.has(nextKey)) {
                            cx = nx;
                            cy = ny;
                            dir = checkDir;
                            contour.push({ x: cx, y: cy });
                            processed.add(nextKey);
                            found = true;
                            break;
                        }
                    }
                }

                if (!found) {
                    // No unprocessed border neighbor found
                    // Check if we can continue along current direction
                    const [dx, dy] = directions[dir];
                    const nx = cx + dx;
                    const ny = cy + dy;
                    const nextKey = `${nx},${ny}`;
                    
                    if (borderPixelSet.has(nextKey)) {
                        if (processed.has(nextKey) && nx === startX && ny === startY) {
                            // We've looped back to start
                            contour.push({ x: startX, y: startY });
                            break;
                        }
                        // Continue along current direction
                        cx = nx;
                        cy = ny;
                        contour.push({ x: cx, y: cy });
                        processed.add(nextKey);
                    } else {
                        // Can't continue, contour is complete
                        // Close it if not already closed
                        if (contour.length > 0 && 
                            (contour[0].x !== contour[contour.length - 1].x ||
                             contour[0].y !== contour[contour.length - 1].y)) {
                            contour.push({ x: contour[0].x, y: contour[0].y });
                        }
                        break;
                    }
                }
            }

            // Add contour if it has at least 3 points (triangle minimum)
            if (contour.length >= 3) {
                contours.push(contour);
            }
        }
    }

    return contours;
}

/**
 * Generates a blueprint v2: quantizes image, extracts region contours
 */
export async function generateBlueprintV2Handler(
    input: GenerateBlueprintV2Input
): Promise<GenerateBlueprintV2Output> {
    const {
        imageId,
        imageBase64,
        paletteSize,
        maxSize = 2048,
        seed = 42,
        returnPreview = false,
        minRegionArea = 0,
        mergeSmallRegions: mergeSmallRegionsParam,
    } = input;

    // Determine if region merging should be enabled
    const shouldMergeRegions = minRegionArea > 0 && (mergeSmallRegionsParam !== false);

    // Validate input
    if (!imageId && !imageBase64) {
        return {
            ok: false,
            error: "Either 'imageId' or 'imageBase64' must be provided",
        };
    }

    if (paletteSize <= 0 || !Number.isInteger(paletteSize)) {
        return {
            ok: false,
            error: "paletteSize must be a positive integer",
        };
    }

    try {
        let cachedImage: CachedImage | null = null;
        let width: number;
        let height: number;
        let imageBuffer: Buffer;

        if (imageId) {
            // Try to get from cache using imageId
            cachedImage = getCachedImage(imageId);
            if (!cachedImage) {
                return {
                    ok: false,
                    error: `Image with ID '${imageId}' not found in cache. Register the image first using image_register.`,
                };
            }
            width = cachedImage.width;
            height = cachedImage.height;
            imageBuffer = cachedImage.buffer;
        } else if (imageBase64) {
            // Extract base64 data
            const base64Data = extractBase64(imageBase64);

            // Check cache for decoded+resized image
            const cacheKey = generateCacheKey(base64Data, maxSize);
            cachedImage = getCachedImage(cacheKey);

            if (cachedImage) {
                // Use cached image
                width = cachedImage.width;
                height = cachedImage.height;
                imageBuffer = cachedImage.buffer;
            } else {
                // Decode base64 to buffer
                const decodedBuffer = Buffer.from(base64Data, "base64");

                // Load image with sharp and get metadata
                let image = sharp(decodedBuffer);
                const metadata = await image.metadata();

                if (!metadata.width || !metadata.height) {
                    return {
                        ok: false,
                        error: "Unable to read image dimensions",
                    };
                }

                // Resize if needed (preserve aspect ratio)
                const originalWidth = metadata.width;
                const originalHeight = metadata.height;
                const maxDimension = Math.max(originalWidth, originalHeight);

                if (maxDimension > maxSize) {
                    const scale = maxSize / maxDimension;
                    const newWidth = Math.round(originalWidth * scale);
                    const newHeight = Math.round(originalHeight * scale);
                    image = image.resize(newWidth, newHeight, {
                        fit: "inside",
                        withoutEnlargement: true,
                    });
                }

                // Get final dimensions after resize
                const resizedMetadata = await image.metadata();
                width = resizedMetadata.width || originalWidth;
                height = resizedMetadata.height || originalHeight;

                // Get full resized image as raw RGBA buffer
                const { data: fullImageData } = await image
                    .ensureAlpha()
                    .raw()
                    .toBuffer({ resolveWithObject: true });

                imageBuffer = fullImageData;
            }
        } else {
            // This should never happen due to validation above
            return {
                ok: false,
                error: "Either 'imageId' or 'imageBase64' must be provided",
            };
        }

        // Extract all pixels as RGB (skip alpha channel)
        const pixels: RGB[] = [];
        for (let i = 0; i < imageBuffer.length; i += 4) {
            pixels.push({
                r: imageBuffer[i],
                g: imageBuffer[i + 1],
                b: imageBuffer[i + 2],
            });
        }

        const totalPixels = pixels.length;

        if (totalPixels === 0) {
            return {
                ok: false,
                error: "Image contains no pixels",
            };
        }

        // Convert RGB pixels to Lab
        const labPixels = pixels.map((rgb) => rgbToLab(rgb));

        // Initialize seeded RNG for deterministic k-means
        const rng = new SeededRNG(seed);

        // Quantize using k-means in Lab space
        let { clusters: labCentroids, labels } = quantizeLab(labPixels, paletteSize, rng);

        // Region cleanup: merge small regions if enabled
        if (shouldMergeRegions) {
            // Extract connected components (regions) per cluster label
            const { regions } = extractRegions(width, height, labels);

            // Merge small regions
            labels = mergeSmallRegions(
                width,
                height,
                regions,
                minRegionArea,
                labels,
                labPixels,
                false // Use majority adjacency (simpler)
            );
        }

        // Extract regions and contours
        const { regions: internalRegions, regionLabelMap } = extractRegions(width, height, labels);

        // Filter out empty regions
        const validRegions = internalRegions.filter((r) => r.pixelIndices.length > 0);

        // Extract contours for each region
        const regions: Region[] = [];
        for (const internalRegion of validRegions) {
            // Calculate bounding box
            let minX = width;
            let minY = height;
            let maxX = -1;
            let maxY = -1;

            for (const pixelIdx of internalRegion.pixelIndices) {
                const x = pixelIdx % width;
                const y = Math.floor(pixelIdx / width);
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }

            // Extract contours
            const contours = extractContours(
                width,
                height,
                regionLabelMap,
                internalRegion.id,
                internalRegion.pixelIndices
            );

            regions.push({
                labelIndex: internalRegion.clusterIndex,
                areaPx: internalRegion.pixelIndices.length,
                bbox: {
                    x0: minX,
                    y0: minY,
                    x1: maxX + 1, // Exclusive
                    y1: maxY + 1, // Exclusive
                },
                contours,
            });
        }

        // Count pixels per cluster and compute mean RGB for each cluster (after merging)
        const clusterCounts = new Array(paletteSize).fill(0);
        const clusterRgbSums: RGB[] = Array.from({ length: paletteSize }, () => ({ r: 0, g: 0, b: 0 }));

        labels.forEach((label, pixelIndex) => {
            clusterCounts[label]++;
            const pixelRgb = pixels[pixelIndex];
            clusterRgbSums[label].r += pixelRgb.r;
            clusterRgbSums[label].g += pixelRgb.g;
            clusterRgbSums[label].b += pixelRgb.b;
        });

        // Build palette with mean RGB values
        const palette: PaletteColor[] = [];
        for (let i = 0; i < labCentroids.length; i++) {
            const count = clusterCounts[i];
            const percent = (count / totalPixels) * 100;

            // Compute mean RGB for this cluster
            const rgb: RGB = count > 0
                ? {
                      r: Math.round(clusterRgbSums[i].r / count),
                      g: Math.round(clusterRgbSums[i].g / count),
                      b: Math.round(clusterRgbSums[i].b / count),
                  }
                : { r: 0, g: 0, b: 0 }; // Fallback if cluster is empty

            const hex = rgbToHex(rgb);
            const lab = labCentroids[i]; // Use Lab centroid from k-means

            // Get DMC match for this palette color
            const matchResult = matchDmcHandler({ rgb });

            palette.push({
                rgb,
                hex,
                lab,
                count,
                percent: Math.round(percent * 100) / 100, // Round to 2 decimal places
                dmcMatch: {
                    ok: matchResult.ok,
                    best: matchResult.best,
                    alternatives: matchResult.alternatives,
                    method: matchResult.method || "lab-d65-deltae76",
                },
            });
        }

        // Sort palette by count (descending)
        palette.sort((a, b) => b.count - a.count);

        // Generate preview image if requested
        let indexedPreviewPngBase64: string | undefined;
        if (returnPreview) {
            // Create a map from original cluster index to RGB (before palette sorting)
            const clusterRgbMap: RGB[] = [];
            for (let i = 0; i < paletteSize; i++) {
                const count = clusterCounts[i];
                const rgb: RGB = count > 0
                    ? {
                          r: Math.round(clusterRgbSums[i].r / count),
                          g: Math.round(clusterRgbSums[i].g / count),
                          b: Math.round(clusterRgbSums[i].b / count),
                      }
                    : { r: 0, g: 0, b: 0 };
                clusterRgbMap[i] = rgb;
            }

            // Create preview image buffer: replace each pixel with its cluster mean RGB
            const previewPixels = new Uint8Array(width * height * 3);
            for (let i = 0; i < labels.length; i++) {
                const label = labels[i];
                const rgb = clusterRgbMap[label];
                const pixelIdx = i * 3;
                previewPixels[pixelIdx] = rgb.r;
                previewPixels[pixelIdx + 1] = rgb.g;
                previewPixels[pixelIdx + 2] = rgb.b;
            }

            // Encode as PNG using sharp
            const previewBuffer = await sharp(previewPixels, {
                raw: {
                    width,
                    height,
                    channels: 3,
                },
            })
                .png()
                .toBuffer();

            indexedPreviewPngBase64 = previewBuffer.toString("base64");
        }

        return {
            ok: true,
            width,
            height,
            palette,
            regions,
            ...(indexedPreviewPngBase64 && { indexedPreviewPngBase64 }),
            method: "lab-kmeans-deltae76-contours",
        };
    } catch (error) {
        if (error instanceof Error) {
            if (
                error.message.includes("Invalid base64") ||
                error.message.includes("base64") ||
                error.message.includes("unsupported image format") ||
                error.message.includes("Input buffer")
            ) {
                return {
                    ok: false,
                    error: "Invalid base64 image data",
                };
            }
            return {
                ok: false,
                error: `Failed to generate blueprint: ${error.message}`,
            };
        }
        return {
            ok: false,
            error: "Unknown error during blueprint generation",
        };
    }
}

/**
 * Generate blueprint v2 tool definition for MCP
 */
export const generateBlueprintV2Tool = {
    name: "generate_blueprint_v2",
    description:
        "Quantizes an image into N perceptual colors using Lab color space, extracts region contours (polylines), returns palette + per-region contours. Phase 2: contour extraction (no SVG).",
    inputSchema: {
        type: "object",
        properties: {
            imageId: {
                type: "string",
                description: "Image ID from image_register (use for session-based processing)",
            },
            imageBase64: {
                type: "string",
                description: "Base64-encoded image data (use for one-shot processing)",
            },
            paletteSize: {
                type: "number",
                description: "Number of colors to quantize to (positive integer)",
                minimum: 1,
            },
            maxSize: {
                type: "number",
                description: "Maximum dimension for image resize (default: 2048, only used when imageBase64 is provided)",
                default: 2048,
            },
            seed: {
                type: "number",
                description: "Optional seed for deterministic output (default: 42)",
            },
            returnPreview: {
                type: "boolean",
                description: "If true, return indexedPreviewPngBase64 with quantized preview image (default: false)",
                default: false,
            },
            minRegionArea: {
                type: "number",
                description: "Minimum region area in pixels for region cleanup (default: 0, meaning off). Recommended: 50-200 depending on maxSize.",
                minimum: 0,
            },
            mergeSmallRegions: {
                type: "boolean",
                description: "If true, merge regions smaller than minRegionArea (default: true when minRegionArea > 0, false otherwise)",
            },
        },
        required: ["paletteSize"],
    },
};
