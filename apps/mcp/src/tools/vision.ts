/**
 * Instrument CW-01: Image Region Analysis
 * Sensor Data Acquisition Unit
 */

import sharp from "sharp";
import { existsSync } from "fs";
import { resolve } from "path";

/**
 * Result of image region analysis
 */
export type ImageRegionResult = {
    hex: string;
    rgb: {
        r: number;
        g: number;
        b: number;
    };
    region: {
        x: number;
        y: number;
        radius: number;
    };
};

/**
 * Analyzes a square region of an image and returns averaged color values
 * 
 * @param imagePath - Path to the image file
 * @param x - X coordinate of the region center
 * @param y - Y coordinate of the region center
 * @param radius - Radius of the square region (default: 5)
 * @returns ImageRegionResult with averaged HEX and RGB values
 * @throws Error if image path is invalid or processing fails
 */
export async function analyzeImageRegion(
    imagePath: string,
    x: number,
    y: number,
    radius: number = 5
): Promise<ImageRegionResult> {
    // Resolve absolute path
    const resolvedPath = resolve(imagePath);
    
    // Validate file exists
    if (!existsSync(resolvedPath)) {
        throw new Error("ERROR-CW-01: Visual source not found.");
    }

    try {
        // Load image metadata to validate dimensions
        const metadata = await sharp(resolvedPath).metadata();
        const width = metadata.width || 0;
        const height = metadata.height || 0;

        // Validate coordinates are within image bounds
        const left = Math.max(0, Math.floor(x - radius));
        const top = Math.max(0, Math.floor(y - radius));
        const right = Math.min(width, Math.ceil(x + radius));
        const bottom = Math.min(height, Math.ceil(y + radius));

        if (left >= right || top >= bottom) {
            throw new Error("ERROR-CW-01: Visual source not found.");
        }

        // Extract region and get raw pixel data
        const regionWidth = right - left;
        const regionHeight = bottom - top;

        const { data } = await sharp(resolvedPath)
            .extract({
                left,
                top,
                width: regionWidth,
                height: regionHeight,
            })
            .raw()
            .toBuffer({ resolveWithObject: true });

        // Calculate average RGB values
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        const pixelCount = regionWidth * regionHeight;

        // Sharp returns raw pixel data as RGBA (4 bytes per pixel)
        for (let i = 0; i < data.length; i += 4) {
            sumR += data[i];
            sumG += data[i + 1];
            sumB += data[i + 2];
            // Skip alpha channel (data[i + 3])
        }

        const avgR = Math.round(sumR / pixelCount);
        const avgG = Math.round(sumG / pixelCount);
        const avgB = Math.round(sumB / pixelCount);

        // Convert RGB to HEX
        const hex = `#${[avgR, avgG, avgB]
            .map((val) => val.toString(16).padStart(2, "0"))
            .join("")
            .toUpperCase()}`;

        return {
            hex,
            rgb: {
                r: avgR,
                g: avgG,
                b: avgB,
            },
            region: {
                x,
                y,
                radius,
            },
        };
    } catch (error) {
        if (error instanceof Error && error.message.startsWith("ERROR-CW-01")) {
            throw error;
        }
        throw new Error("ERROR-CW-01: Visual source not found.");
    }
}
