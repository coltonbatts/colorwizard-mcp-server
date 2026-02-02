/**
 * Unit tests for generate_blueprint_v2 tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { generateBlueprintV2Handler, type GenerateBlueprintV2Input } from '../generate_blueprint_v2.js';
import { imageRegisterHandler, type ImageRegisterInput, clearImageCache } from '../sample_color.js';

// Tiny 10x10 red square PNG (base64)
const RED_SQUARE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFElEQVR4nGP4z8CABzGMSjNgCRYAt8pjnQuW8k0AAAAASUVORK5CYII=';

describe('generate_blueprint_v2 tool', () => {
    beforeEach(() => {
        clearImageCache();
    });

    describe('valid inputs', () => {
        it('should quantize image and return palette with regions and contours', async () => {
            const input: GenerateBlueprintV2Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 3,
            };

            const result = await generateBlueprintV2Handler(input);

            expect(result.ok).toBe(true);
            expect(result.width).toBeDefined();
            expect(result.height).toBeDefined();
            expect(result.palette).toBeDefined();
            expect(Array.isArray(result.palette)).toBe(true);
            expect(result.palette?.length).toBeLessThanOrEqual(3);
            expect(result.regions).toBeDefined();
            expect(Array.isArray(result.regions)).toBe(true);
            expect(result.method).toBe('lab-kmeans-deltae76-contours');

            // Check palette structure
            if (result.palette && result.palette.length > 0) {
                const color = result.palette[0];
                expect(color).toHaveProperty('rgb');
                expect(color).toHaveProperty('hex');
                expect(color).toHaveProperty('lab');
                expect(color).toHaveProperty('count');
                expect(color).toHaveProperty('percent');
                expect(color).toHaveProperty('dmcMatch');
            }

            // Check regions structure
            if (result.regions && result.regions.length > 0) {
                const region = result.regions[0];
                expect(region).toHaveProperty('labelIndex');
                expect(region).toHaveProperty('areaPx');
                expect(region).toHaveProperty('bbox');
                expect(region).toHaveProperty('contours');
                
                expect(typeof region.labelIndex).toBe('number');
                expect(typeof region.areaPx).toBe('number');
                expect(region.areaPx).toBeGreaterThan(0);
                
                expect(region.bbox).toHaveProperty('x0');
                expect(region.bbox).toHaveProperty('y0');
                expect(region.bbox).toHaveProperty('x1');
                expect(region.bbox).toHaveProperty('y1');
                
                expect(Array.isArray(region.contours)).toBe(true);
                if (region.contours.length > 0) {
                    const contour = region.contours[0];
                    expect(Array.isArray(contour)).toBe(true);
                    if (contour.length > 0) {
                        const point = contour[0];
                        expect(point).toHaveProperty('x');
                        expect(point).toHaveProperty('y');
                        expect(typeof point.x).toBe('number');
                        expect(typeof point.y).toBe('number');
                    }
                }
            }
        });

        it('should return regions with valid bounding boxes', async () => {
            const input: GenerateBlueprintV2Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 2,
            };

            const result = await generateBlueprintV2Handler(input);

            expect(result.ok).toBe(true);
            if (result.regions && result.width && result.height) {
                for (const region of result.regions) {
                    expect(region.bbox.x0).toBeGreaterThanOrEqual(0);
                    expect(region.bbox.y0).toBeGreaterThanOrEqual(0);
                    expect(region.bbox.x1).toBeLessThanOrEqual(result.width);
                    expect(region.bbox.y1).toBeLessThanOrEqual(result.height);
                    expect(region.bbox.x0).toBeLessThan(region.bbox.x1);
                    expect(region.bbox.y0).toBeLessThan(region.bbox.y1);
                }
            }
        });

        it('should have regions sum(areaPx) == width*height', async () => {
            const input: GenerateBlueprintV2Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 3,
            };

            const result = await generateBlueprintV2Handler(input);

            expect(result.ok).toBe(true);
            if (result.regions && result.width && result.height) {
                const totalArea = result.regions.reduce((sum, r) => sum + r.areaPx, 0);
                expect(totalArea).toBe(result.width * result.height);
            }
        });

        it('should work with imageId from registered image', async () => {
            // First register the image
            const registerInput: ImageRegisterInput = {
                imageBase64: RED_SQUARE_BASE64,
                maxSize: 2048,
            };
            const registerResult = await imageRegisterHandler(registerInput);
            expect(registerResult.ok).toBe(true);
            expect(registerResult.imageId).toBeDefined();

            // Now use imageId
            const input: GenerateBlueprintV2Input = {
                imageId: registerResult.imageId!,
                paletteSize: 3,
            };

            const result = await generateBlueprintV2Handler(input);

            expect(result.ok).toBe(true);
            expect(result.palette).toBeDefined();
            expect(result.regions).toBeDefined();
            expect(result.width).toBeDefined();
            expect(result.height).toBeDefined();
        });
    });

    describe('synthetic label map case', () => {
        it('should extract contours from two regions with known shapes', async () => {
            // Create a simple 20x20 image with two distinct regions: left half red, right half blue
            const width = 20;
            const height = 20;
            const pixels = new Uint8Array(width * height * 4);
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    if (x < width / 2) {
                        // Left half: red
                        pixels[idx] = 255;     // R
                        pixels[idx + 1] = 0;   // G
                        pixels[idx + 2] = 0;   // B
                    } else {
                        // Right half: blue
                        pixels[idx] = 0;       // R
                        pixels[idx + 1] = 0;   // G
                        pixels[idx + 2] = 255; // B
                    }
                    pixels[idx + 3] = 255; // A
                }
            }

            // Convert to base64 PNG
            const sharp = await import('sharp');
            const imageBuffer = await sharp.default(pixels, {
                raw: { width, height, channels: 4 }
            }).png().toBuffer();
            const testImageBase64 = imageBuffer.toString('base64');

            const input: GenerateBlueprintV2Input = {
                imageBase64: testImageBase64,
                paletteSize: 2,
                seed: 42,
            };

            const result = await generateBlueprintV2Handler(input);

            expect(result.ok).toBe(true);
            expect(result.regions).toBeDefined();
            
            if (result.regions) {
                // Should have at least one region
                expect(result.regions.length).toBeGreaterThan(0);
                
                // Each region should have contours
                for (const region of result.regions) {
                    expect(region.contours.length).toBeGreaterThan(0);
                    
                    // Each contour should have at least 3 points (triangle minimum)
                    for (const contour of region.contours) {
                        expect(contour.length).toBeGreaterThanOrEqual(3);
                        
                        // Check that contour points are valid coordinates
                        for (const point of contour) {
                            expect(point.x).toBeGreaterThanOrEqual(0);
                            expect(point.y).toBeGreaterThanOrEqual(0);
                            if (result.width && result.height) {
                                expect(point.x).toBeLessThan(result.width);
                                expect(point.y).toBeLessThan(result.height);
                            }
                        }
                    }
                }
                
                // Total area should match image size
                const totalArea = result.regions.reduce((sum, r) => sum + r.areaPx, 0);
                if (result.width && result.height) {
                    expect(totalArea).toBe(result.width * result.height);
                }
            }
        });

        it('should extract contours from a square region', async () => {
            // Create a 30x30 image with a 10x10 square in the center
            const width = 30;
            const height = 30;
            const pixels = new Uint8Array(width * height * 4);
            
            // Fill with background color (black)
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    pixels[idx] = 0;       // R
                    pixels[idx + 1] = 0;   // G
                    pixels[idx + 2] = 0;   // B
                    pixels[idx + 3] = 255; // A
                }
            }
            
            // Draw a 10x10 white square in the center
            const squareSize = 10;
            const startX = Math.floor((width - squareSize) / 2);
            const startY = Math.floor((height - squareSize) / 2);
            
            for (let y = startY; y < startY + squareSize; y++) {
                for (let x = startX; x < startX + squareSize; x++) {
                    const idx = (y * width + x) * 4;
                    pixels[idx] = 255;     // R
                    pixels[idx + 1] = 255; // G
                    pixels[idx + 2] = 255; // B
                    pixels[idx + 3] = 255; // A
                }
            }

            // Convert to base64 PNG
            const sharp = await import('sharp');
            const imageBuffer = await sharp.default(pixels, {
                raw: { width, height, channels: 4 }
            }).png().toBuffer();
            const testImageBase64 = imageBuffer.toString('base64');

            const input: GenerateBlueprintV2Input = {
                imageBase64: testImageBase64,
                paletteSize: 2,
                seed: 42,
            };

            const result = await generateBlueprintV2Handler(input);

            expect(result.ok).toBe(true);
            expect(result.regions).toBeDefined();
            
            if (result.regions) {
                // Should have regions
                expect(result.regions.length).toBeGreaterThan(0);
                
                // Find the square region (should be the white one)
                const squareRegion = result.regions.find(r => r.areaPx >= squareSize * squareSize - 5); // Allow small tolerance
                
                if (squareRegion) {
                    // Should have contours
                    expect(squareRegion.contours.length).toBeGreaterThan(0);
                    
                    // Contour should form a closed loop
                    for (const contour of squareRegion.contours) {
                        if (contour.length > 0) {
                            const first = contour[0];
                            const last = contour[contour.length - 1];
                            // Contour should be closed (first and last points match)
                            expect(first.x).toBe(last.x);
                            expect(first.y).toBe(last.y);
                        }
                    }
                }
            }
        });
    });

    describe('deterministic behavior', () => {
        it('should produce identical results for same input and seed', async () => {
            const input: GenerateBlueprintV2Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 3,
                seed: 12345,
            };

            const result1 = await generateBlueprintV2Handler(input);
            const result2 = await generateBlueprintV2Handler(input);

            expect(result1.ok).toBe(true);
            expect(result2.ok).toBe(true);
            
            // Results should be identical with same seed
            expect(result1.width).toBe(result2.width);
            expect(result1.height).toBe(result2.height);
            expect(result1.palette?.length).toBe(result2.palette?.length);
            
            // Verify exact palette match
            if (result1.palette && result2.palette) {
                expect(result1.palette.length).toBe(result2.palette.length);
                for (let i = 0; i < result1.palette.length; i++) {
                    expect(result1.palette[i].rgb.r).toBe(result2.palette[i].rgb.r);
                    expect(result1.palette[i].rgb.g).toBe(result2.palette[i].rgb.g);
                    expect(result1.palette[i].rgb.b).toBe(result2.palette[i].rgb.b);
                    expect(result1.palette[i].count).toBe(result2.palette[i].count);
                }
            }
            
            // Verify regions match
            if (result1.regions && result2.regions) {
                expect(result1.regions.length).toBe(result2.regions.length);
                for (let i = 0; i < result1.regions.length; i++) {
                    const r1 = result1.regions[i];
                    const r2 = result2.regions[i];
                    expect(r1.labelIndex).toBe(r2.labelIndex);
                    expect(r1.areaPx).toBe(r2.areaPx);
                    expect(r1.bbox.x0).toBe(r2.bbox.x0);
                    expect(r1.bbox.y0).toBe(r2.bbox.y0);
                    expect(r1.bbox.x1).toBe(r2.bbox.x1);
                    expect(r1.bbox.y1).toBe(r2.bbox.y1);
                    expect(r1.contours.length).toBe(r2.contours.length);
                }
            }
        });

        it('should use default seed when seed is not provided', async () => {
            const input1: GenerateBlueprintV2Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 3,
                seed: 42, // Default seed
            };

            const input2: GenerateBlueprintV2Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 3,
                // No seed provided, should default to 42
            };

            const result1 = await generateBlueprintV2Handler(input1);
            const result2 = await generateBlueprintV2Handler(input2);

            expect(result1.ok).toBe(true);
            expect(result2.ok).toBe(true);
            
            // Results should be identical (both using seed 42)
            if (result1.palette && result2.palette) {
                expect(result1.palette.length).toBe(result2.palette.length);
                for (let i = 0; i < result1.palette.length; i++) {
                    expect(result1.palette[i].count).toBe(result2.palette[i].count);
                }
            }
        });
    });

    describe('invalid inputs', () => {
        it('should return ok:false for missing imageId and imageBase64', async () => {
            const input: GenerateBlueprintV2Input = {
                paletteSize: 3,
            } as GenerateBlueprintV2Input;

            const result = await generateBlueprintV2Handler(input);

            expect(result.ok).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Either');
        });

        it('should return ok:false for invalid paletteSize (zero)', async () => {
            const input: GenerateBlueprintV2Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 0,
            };

            const result = await generateBlueprintV2Handler(input);

            expect(result.ok).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('positive integer');
        });
    });

    describe('region cleanup', () => {
        it('should merge small regions when minRegionArea is set', async () => {
            // Create a checkerboard pattern that will create small regions
            const width = 20;
            const height = 20;
            const pixels = new Uint8Array(width * height * 4);
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    if ((x + y) % 2 === 0) {
                        pixels[idx] = 255;     // R
                        pixels[idx + 1] = 0;   // G
                        pixels[idx + 2] = 0;   // B
                    } else {
                        pixels[idx] = 0;       // R
                        pixels[idx + 1] = 0;   // G
                        pixels[idx + 2] = 255; // B
                    }
                    pixels[idx + 3] = 255; // A
                }
            }

            const sharp = await import('sharp');
            const imageBuffer = await sharp.default(pixels, {
                raw: { width, height, channels: 4 }
            }).png().toBuffer();
            const testImageBase64 = imageBuffer.toString('base64');

            const input: GenerateBlueprintV2Input = {
                imageBase64: testImageBase64,
                paletteSize: 2,
                seed: 42,
                minRegionArea: 5,
            };

            const result = await generateBlueprintV2Handler(input);

            expect(result.ok).toBe(true);
            expect(result.regions).toBeDefined();
            
            if (result.regions && result.width && result.height) {
                // Total area should still match image size
                const totalArea = result.regions.reduce((sum, r) => sum + r.areaPx, 0);
                expect(totalArea).toBe(result.width * result.height);
            }
        });
    });

    describe('preview image', () => {
        it('should return preview image when returnPreview is true', async () => {
            const input: GenerateBlueprintV2Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 3,
                returnPreview: true,
            };

            const result = await generateBlueprintV2Handler(input);

            expect(result.ok).toBe(true);
            expect(result.indexedPreviewPngBase64).toBeDefined();
            expect(typeof result.indexedPreviewPngBase64).toBe('string');
            expect(result.indexedPreviewPngBase64!.length).toBeGreaterThan(0);
            
            // Verify it's valid base64 PNG
            const previewBuffer = Buffer.from(result.indexedPreviewPngBase64!, 'base64');
            expect(previewBuffer[0]).toBe(0x89);
            expect(previewBuffer[1]).toBe(0x50); // P
            expect(previewBuffer[2]).toBe(0x4E); // N
            expect(previewBuffer[3]).toBe(0x47); // G
        });

        it('should not return preview image when returnPreview is false', async () => {
            const input: GenerateBlueprintV2Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 3,
                returnPreview: false,
            };

            const result = await generateBlueprintV2Handler(input);

            expect(result.ok).toBe(true);
            expect(result.indexedPreviewPngBase64).toBeUndefined();
        });
    });
});
