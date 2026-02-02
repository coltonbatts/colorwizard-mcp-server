/**
 * Instrument CW-07: Blueprint Generation v1
 * Quantizes an image into N perceptual colors (Lab), returns palette + per-color pixel counts, and DMC matches
 */

import sharp from "sharp";
import { rgbToLab, deltaE76, type RGB, type Lab } from "../lib/color/lab.js";
import { matchDmcHandler, type MatchDmcOutput } from "./match_dmc.js";
import { getCachedImage, generateCacheKey, extractBase64, type CachedImage } from "./sample_color.js";
import { SeededRNG } from "../lib/rng.js";

export interface GenerateBlueprintV1Input {
    imageId?: string; // Image ID from image_register (alternative to imageBase64)
    imageBase64?: string; // Base64-encoded image data (alternative to imageId)
    paletteSize: number; // Number of colors to quantize to
    maxSize?: number; // Default 2048 (only used when imageBase64 is provided)
    seed?: number; // Optional seed for deterministic output (default: 42)
    returnPreview?: boolean; // If true, return indexedPreviewPngBase64 (default: false)
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

export interface GenerateBlueprintV1Output {
    ok: boolean;
    palette?: PaletteColor[];
    totalPixels?: number;
    method?: string;
    indexedPreviewPngBase64?: string; // Base64-encoded PNG preview (quantized image)
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
 * Generates a blueprint v1: quantizes image into N colors and returns palette with DMC matches
 */
export async function generateBlueprintV1Handler(
    input: GenerateBlueprintV1Input
): Promise<GenerateBlueprintV1Output> {
    const { imageId, imageBase64, paletteSize, maxSize = 2048, seed = 42, returnPreview = false } = input;

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
        const { clusters: labCentroids, labels } = quantizeLab(labPixels, paletteSize, rng);

        // Count pixels per cluster and compute mean RGB for each cluster
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
            palette,
            totalPixels,
            method: "lab-kmeans-deltae76",
            ...(indexedPreviewPngBase64 && { indexedPreviewPngBase64 }),
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
 * Generate blueprint v1 tool definition for MCP
 */
export const generateBlueprintV1Tool = {
    name: "generate_blueprint_v1",
    description:
        "Quantizes an image into N perceptual colors using Lab color space, returns a palette with per-color pixel counts and DMC thread matches. Phase 1: no SVG tracing, no region adjacency, no contours.",
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
        },
        required: ["paletteSize"],
    },
};
