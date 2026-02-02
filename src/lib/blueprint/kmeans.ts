/**
 * K-means Quantization for Blueprint Mode
 * Operates in CIELAB color space for perceptual uniformity
 */

import { calculateDeltaE } from "../../engine/spectral.js";

export interface LAB {
    l: number;
    a: number;
    b: number;
}

export interface RGB {
    r: number;
    g: number;
    b: number;
}

/**
 * Converts sRGB to CIE LAB (re-implemented since it's not exported from spectral.ts)
 */
export function rgbToLAB(rgb: RGB): LAB {
    // Linearize sRGB
    const linearize = (v: number) => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };

    const r = linearize(rgb.r);
    const g = linearize(rgb.g);
    const b = linearize(rgb.b);

    // sRGB to XYZ (D65)
    let x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
    let y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
    let z = r * 0.0193339 + g * 0.119192 + b * 0.9503041;

    x *= 100;
    y *= 100;
    z *= 100;

    // XYZ to LAB (D65 white point)
    const xw = 95.047;
    const yw = 100.0;
    const zw = 108.883;

    const f = (t: number) => (t > 0.008856 ? Math.pow(t, 1 / 3) : 7.787 * t + 16 / 116);

    const fx = f(x / xw);
    const fy = f(y / yw);
    const fz = f(z / zw);

    return {
        l: 116 * fy - 16,
        a: 500 * (fx - fy),
        b: 200 * (fy - fz)
    };
}

/**
 * K-means clustering in LAB space
 */
export function quantize(pixels: LAB[], k: number, maxIterations: number = 20): { clusters: LAB[], labels: number[] } {
    if (pixels.length === 0) return { clusters: [], labels: [] };
    if (k >= pixels.length) {
        return { clusters: pixels, labels: pixels.map((_, i) => i) };
    }

    // Initialize centroids randomly (Forgery-resistant: pick unique pixels)
    let centroids: LAB[] = [];
    const usedIndices = new Set<number>();
    while (centroids.length < k) {
        const idx = Math.floor(Math.random() * pixels.length);
        if (!usedIndices.has(idx)) {
            centroids.push({ ...pixels[idx] });
            usedIndices.add(idx);
        }
    }

    let labels = new Array(pixels.length).fill(0);
    let converged = false;

    for (let iter = 0; iter < maxIterations && !converged; iter++) {
        // Assignment step
        const newLabels = pixels.map(pixel => {
            let minDist = Infinity;
            let bestCluster = 0;
            centroids.forEach((centroid, i) => {
                const dist = calculateDeltaE(pixel, centroid);
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

        // Update step
        const newCentroids: LAB[] = Array.from({ length: k }, () => ({ l: 0, a: 0, b: 0 }));
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
                b: c.b / counts[i]
            };
        });
    }

    return { clusters: centroids, labels };
}
