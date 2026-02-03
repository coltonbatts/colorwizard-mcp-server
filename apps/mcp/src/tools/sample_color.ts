/**
 * Instrument CW-06: Color Sampling
 * Samples pixel(s) from base64 image and returns color data + DMC match
 */

import { createHash } from "crypto";
import sharp from "sharp";
import { rgbToLab, type RGB, type Lab } from "../lib/color/lab.js";
import { matchDmcHandler, type MatchDmcOutput } from "./match_dmc.js";

export interface SampleColorInput {
    imageId?: string; // Image ID from image_register (alternative to imageBase64)
    imageBase64?: string; // Base64-encoded image data (alternative to imageId)
    x: number; // Normalized 0-1
    y: number; // Normalized 0-1
    radius?: number; // Default 0 (single pixel)
    maxSize?: number; // Default 2048 (only used when imageBase64 is provided)
}

export interface SampleColorOutput {
    ok: boolean;
    rgb?: RGB;
    hex?: string;
    lab?: Lab;
    match?: {
        ok: boolean;
        best: MatchDmcOutput["best"];
        alternatives: MatchDmcOutput["alternatives"];
        method: string;
    };
    method?: string;
    inputNormalized?: {
        rgb: RGB;
        hex: string;
    };
    error?: string;
}

/**
 * Cached image data structure
 */
export interface CachedImage {
    buffer: Buffer; // Raw RGBA buffer
    width: number;
    height: number;
    lastAccessed: number; // Timestamp for LRU eviction
}

/**
 * Module-level cache for decoded+resized images
 * Key: hash(imageBase64 + maxSize) -> CachedImage
 */
const imageCache = new Map<string, CachedImage>();
const MAX_CACHE_SIZE = 5;

/**
 * Debug stats for testing (guarded under NODE_ENV==="test")
 * Always created - tests can access and reset via beforeEach
 */
export const debugStats: { cacheHits: number; cacheMisses: number } = { cacheHits: 0, cacheMisses: 0 };

/**
 * Clear cache for testing (exported for test use)
 */
export function clearImageCache(): void {
    imageCache.clear();
}

/**
 * Get cache size (exported for health endpoint)
 */
export function getImageCacheSize(): number {
    return imageCache.size;
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
 * Extracts base64 data from data URL if present
 */
export function extractBase64(data: string): string {
    // Handle data URL format: data:image/png;base64,<base64>
    if (data.includes(",")) {
        return data.split(",")[1];
    }
    return data;
}

/**
 * Generates a cache key from image base64 data and maxSize
 * Exported for use by image_register
 */
export function generateCacheKey(base64Data: string, maxSize: number): string {
    const hash = createHash("sha256");
    hash.update(base64Data);
    hash.update(String(maxSize));
    return hash.digest("hex");
}

/**
 * Gets cached image or null if not found
 */
export function getCachedImage(key: string): CachedImage | null {
    const cached = imageCache.get(key);
    if (cached) {
        cached.lastAccessed = Date.now();
        debugStats.cacheHits++;
        return cached;
    }
    debugStats.cacheMisses++;
    return null;
}

/**
 * Stores image in cache with LRU eviction
 */
function setCachedImage(key: string, image: CachedImage): void {
    // Evict oldest entry if cache is full
    if (imageCache.size >= MAX_CACHE_SIZE) {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;
        
        for (const [k, v] of imageCache.entries()) {
            if (v.lastAccessed < oldestTime) {
                oldestTime = v.lastAccessed;
                oldestKey = k;
            }
        }
        
        if (oldestKey !== null) {
            imageCache.delete(oldestKey);
        }
    }
    
    image.lastAccessed = Date.now();
    imageCache.set(key, image);
}

/**
 * Samples color from base64 image or cached image by ID
 */
export async function sampleColorHandler(input: SampleColorInput): Promise<SampleColorOutput> {
    const { imageId, imageBase64, x, y, radius = 0, maxSize = 2048 } = input;

    // Validate that either imageId or imageBase64 is provided
    if (!imageId && !imageBase64) {
        return {
            ok: false,
            error: "Either 'imageId' or 'imageBase64' must be provided",
        };
    }

    // Validate normalized coordinates
    if (x < 0 || x > 1 || y < 0 || y > 1) {
        return {
            ok: false,
            error: "Coordinates x and y must be between 0 and 1",
        };
    }

    if (radius < 0) {
        return {
            ok: false,
            error: "Radius must be >= 0",
        };
    }

    try {
        let cachedImage: CachedImage | null = null;
        let width: number;
        let height: number;
        let fullImageBuffer: Buffer;
        
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
            fullImageBuffer = cachedImage.buffer;
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
                fullImageBuffer = cachedImage.buffer;
            } else {
                // Decode base64 to buffer
                const imageBuffer = Buffer.from(base64Data, "base64");

                // Load image with sharp and get metadata
                let image = sharp(imageBuffer);
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
                
                // Get full resized image as raw RGBA buffer for caching
                // Ensure we get RGBA format (4 channels)
                const { data: fullImageData } = await image
                    .ensureAlpha()
                    .raw()
                    .toBuffer({ resolveWithObject: true });
                
                fullImageBuffer = fullImageData;
                
                // Cache the decoded+resized image
                setCachedImage(cacheKey, {
                    buffer: fullImageBuffer,
                    width,
                    height,
                    lastAccessed: Date.now(),
                });
            }
        } else {
            // This should never happen due to validation above, but TypeScript needs it
            return {
                ok: false,
                error: "Either 'imageId' or 'imageBase64' must be provided",
            };
        }

        // Convert normalized coordinates to pixel coordinates
        const pixelX = Math.floor(x * width);
        const pixelY = Math.floor(y * height);

        // Clamp to valid range
        const clampedX = Math.max(0, Math.min(width - 1, pixelX));
        const clampedY = Math.max(0, Math.min(height - 1, pixelY));

        // Calculate sampling region
        const left = Math.max(0, Math.floor(clampedX - radius));
        const top = Math.max(0, Math.floor(clampedY - radius));
        const right = Math.min(width, Math.ceil(clampedX + radius + 1));
        const bottom = Math.min(height, Math.ceil(clampedY + radius + 1));

        const regionWidth = right - left;
        const regionHeight = bottom - top;
        const pixelCount = regionWidth * regionHeight;

        if (pixelCount === 0) {
            return {
                ok: false,
                error: "Invalid sampling region: zero pixels",
            };
        }

        // Extract region from raw RGBA buffer manually
        // Raw buffer format: RGBA (4 bytes per pixel), row-major order
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;

        for (let row = top; row < bottom; row++) {
            for (let col = left; col < right; col++) {
                // Calculate pixel index in raw buffer: (row * width + col) * 4
                const pixelIndex = (row * width + col) * 4;
                // Bounds check to prevent buffer overrun
                if (pixelIndex + 2 < fullImageBuffer.length) {
                    sumR += fullImageBuffer[pixelIndex];
                    sumG += fullImageBuffer[pixelIndex + 1];
                    sumB += fullImageBuffer[pixelIndex + 2];
                    // Skip alpha channel (pixelIndex + 3)
                }
            }
        }

        const avgR = Math.round(sumR / pixelCount);
        const avgG = Math.round(sumG / pixelCount);
        const avgB = Math.round(sumB / pixelCount);

        const rgb: RGB = { r: avgR, g: avgG, b: avgB };
        const hex = rgbToHex(rgb);
        const lab = rgbToLab(rgb);

        // Get DMC match using existing handler
        const matchResult = matchDmcHandler({ rgb });

        if (!matchResult.ok) {
            return {
                ok: false,
                error: `Color sampling succeeded but DMC matching failed: ${matchResult.error}`,
            };
        }

        return {
            ok: true,
            rgb,
            hex,
            lab,
            match: {
                ok: true,
                best: matchResult.best,
                alternatives: matchResult.alternatives,
                method: matchResult.method || "lab-d65-deltae76",
            },
            method: "lab-d65-deltae76",
            inputNormalized: {
                rgb,
                hex,
            },
        };
    } catch (error) {
        if (error instanceof Error) {
            // Check for base64 decode errors or invalid image format
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
                error: `Failed to sample image: ${error.message}`,
            };
        }
        return {
            ok: false,
            error: "Unknown error during image sampling",
        };
    }
}

/**
 * Image register input/output interfaces
 */
export interface ImageRegisterInput {
    imageBase64: string;
    maxSize?: number; // Default 2048
}

export interface ImageRegisterOutput {
    ok: boolean;
    imageId?: string;
    width?: number;
    height?: number;
    error?: string;
}

/**
 * Registers an image and returns an imageId for efficient session-based sampling
 */
export async function imageRegisterHandler(input: ImageRegisterInput): Promise<ImageRegisterOutput> {
    const { imageBase64, maxSize = 2048 } = input;

    if (!imageBase64) {
        return {
            ok: false,
            error: "imageBase64 is required",
        };
    }

    try {
        // Extract base64 data
        const base64Data = extractBase64(imageBase64);
        
        // Generate cache key (this will be the imageId)
        const imageId = generateCacheKey(base64Data, maxSize);
        
        // Check if already cached
        let cachedImage = getCachedImage(imageId);
        
        if (!cachedImage) {
            // Decode base64 to buffer
            const imageBuffer = Buffer.from(base64Data, "base64");

            // Load image with sharp and get metadata
            let image = sharp(imageBuffer);
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
            const width = resizedMetadata.width || originalWidth;
            const height = resizedMetadata.height || originalHeight;
            
            // Get full resized image as raw RGBA buffer for caching
            const { data: fullImageData } = await image
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });
            
            // Cache the decoded+resized image
            setCachedImage(imageId, {
                buffer: fullImageData,
                width,
                height,
                lastAccessed: Date.now(),
            });
            
            return {
                ok: true,
                imageId,
                width,
                height,
            };
        } else {
            // Already cached, return existing imageId and dimensions
            return {
                ok: true,
                imageId,
                width: cachedImage.width,
                height: cachedImage.height,
            };
        }
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
                error: `Failed to register image: ${error.message}`,
            };
        }
        return {
            ok: false,
            error: "Unknown error during image registration",
        };
    }
}

/**
 * Image register tool definition for MCP
 */
export const imageRegisterTool = {
    name: "image_register",
    description: "Registers a base64-encoded image and returns an imageId for efficient session-based color sampling. Use this for real-time thumb-drag scenarios where you'll sample multiple times from the same image.",
    inputSchema: {
        type: "object",
        properties: {
            imageBase64: {
                type: "string",
                description: "Base64-encoded image data (with or without data URL prefix)",
            },
            maxSize: {
                type: "number",
                description: "Maximum dimension for image resize (default: 2048)",
                default: 2048,
            },
        },
        required: ["imageBase64"],
    },
};

/**
 * Sample color tool definition for MCP
 */
export const sampleColorTool = {
    name: "sample_color",
    description: "Samples a pixel or small region from an image and returns RGB/hex/Lab color data plus nearest DMC thread match. Can use either imageId (from image_register) or imageBase64 (one-shot mode).",
    inputSchema: {
        type: "object",
        properties: {
            imageId: {
                type: "string",
                description: "Image ID from image_register (use for session-based sampling)",
            },
            imageBase64: {
                type: "string",
                description: "Base64-encoded image data (use for one-shot sampling)",
            },
            x: {
                type: "number",
                description: "Normalized X coordinate (0.0 to 1.0)",
                minimum: 0,
                maximum: 1,
            },
            y: {
                type: "number",
                description: "Normalized Y coordinate (0.0 to 1.0)",
                minimum: 0,
                maximum: 1,
            },
            radius: {
                type: "number",
                description: "Sampling radius in pixels (default: 0 for single pixel)",
                default: 0,
                minimum: 0,
            },
            maxSize: {
                type: "number",
                description: "Maximum dimension for image resize (default: 2048, only used when imageBase64 is provided)",
                default: 2048,
            },
        },
        required: ["x", "y"],
    },
};
