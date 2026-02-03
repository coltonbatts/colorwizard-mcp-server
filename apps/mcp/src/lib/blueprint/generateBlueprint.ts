/**
 * Blueprint Mode Generator
 * Converts images into vector paint-by-number blueprints
 */

import sharp from "sharp";
import { rgbToLAB, quantize, type RGB, type LAB } from "./kmeans.js";
import { extractRegions, mergeSmallRegions, type Region } from "./regions.js";
import { extractContour, simplifyPath, type Point } from "./vectorize.js";

export interface BlueprintOptions {
    imagePath: string;
    numColors?: number;
    minArea?: number;
    epsilon?: number;
    maxDim?: number;
}

export interface BlueprintResult {
    svg: string;
    clusters: RGB[];
    regionCount: number;
}

export async function generateBlueprint(options: BlueprintOptions): Promise<BlueprintResult> {
    const {
        imagePath,
        numColors = 12,
        minArea = 100,
        epsilon = 1.0,
        maxDim = 1024
    } = options;

    const image = sharp(imagePath);
    const metadata = await image.metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    // 1. Preprocess: Downscale
    let resizeW = width;
    let resizeH = height;
    if (width > maxDim || height > maxDim) {
        if (width > height) {
            resizeW = maxDim;
            resizeH = Math.round((height * maxDim) / width);
        } else {
            resizeH = maxDim;
            resizeW = Math.round((width * maxDim) / height);
        }
    }

    const { data: rawPixels, info } = await image
        .resize(resizeW, resizeH)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;

    // 2. Quantize
    const labPixels: LAB[] = [];
    for (let i = 0; i < rawPixels.length; i += 3) {
        labPixels.push(rgbToLAB({
            r: rawPixels[i],
            g: rawPixels[i + 1],
            b: rawPixels[i + 2]
        }));
    }

    const { clusters, labels } = quantize(labPixels, numColors);

    // 3. Extract and Merge Regions
    const rawRegions = extractRegions(w, h, labels);
    const { regions, updatedLabels } = mergeSmallRegions(w, h, rawRegions, minArea, labels);

    // 4. Vectorize and Build SVG
    let svgPaths = "";
    let svgLabels = "";

    regions.forEach((region, i) => {
        const contour = extractContour(w, h, region.pixelIndices);
        const simplified = simplifyPath(contour, epsilon);

        if (simplified.length > 2) {
            const d = simplified.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";
            svgPaths += `  <path d="${d}" fill="none" stroke="black" stroke-width="0.5" />\n`;

            // Add Label
            if (region.pixelIndices.length > minArea * 2) {
                // Find centroid for label
                let cx = 0, cy = 0;
                region.pixelIndices.forEach(idx => {
                    cx += idx % w;
                    cy += Math.floor(idx / w);
                });
                cx /= region.pixelIndices.length;
                cy /= region.pixelIndices.length;

                svgLabels += `  <text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" font-size="8" text-anchor="middle" alignment-baseline="middle" fill="black">${region.clusterIndex + 1}</text>\n`;
            }
        }
    });

    const svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="background: white;">\n${svgPaths}${svgLabels}</svg>`;

    // Convert LAB clusters back to RGB for manifest
    const rgbClusters: RGB[] = clusters.map(c => labToRGB(c));

    return {
        svg,
        clusters: rgbClusters,
        regionCount: regions.length
    };
}

/**
 * Converts LAB to sRGB
 */
function labToRGB(lab: LAB): RGB {
    const fy = (lab.l + 16) / 116;
    const fx = lab.a / 500 + fy;
    const fz = fy - lab.b / 200;

    const t = (f: number) => (f > 6 / 29 ? Math.pow(f, 3) : (3 * Math.pow(6 / 29, 2)) * (f - 4 / 29));

    const xw = 95.047;
    const yw = 100.0;
    const zw = 108.883;

    const x = xw * t(fx) / 100;
    const y = yw * t(fy) / 100;
    const z = zw * t(fz) / 100;

    // XYZ to linear RGB
    let r = x * 3.2404542 - y * 1.5371385 - z * 0.4985314;
    let g = -x * 0.969266 + y * 1.8760108 + z * 0.0415560;
    let b = x * 0.0556434 - y * 0.2040259 + z * 1.0572252;

    const gamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

    return {
        r: Math.max(0, Math.min(255, Math.round(gamma(r) * 255))),
        g: Math.max(0, Math.min(255, Math.round(gamma(g) * 255))),
        b: Math.max(0, Math.min(255, Math.round(gamma(b) * 255)))
    };
}
