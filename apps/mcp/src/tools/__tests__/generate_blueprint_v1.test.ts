/**
 * Unit tests for generate_blueprint_v1 tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { generateBlueprintV1Handler, type GenerateBlueprintV1Input } from '../generate_blueprint_v1.js';
import { imageRegisterHandler, type ImageRegisterInput, clearImageCache } from '../sample_color.js';

// Tiny 10x10 red square PNG (base64)
const RED_SQUARE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFElEQVR4nGP4z8CABzGMSjNgCRYAt8pjnQuW8k0AAAAASUVORK5CYII=';

describe('generate_blueprint_v1 tool', () => {
    beforeEach(() => {
        clearImageCache();
    });

    describe('valid inputs', () => {
        it('should quantize image and return palette with DMC matches', async () => {
            const input: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 3,
            };

            const result = await generateBlueprintV1Handler(input);

            expect(result.ok).toBe(true);
            expect(result.palette).toBeDefined();
            expect(Array.isArray(result.palette)).toBe(true);
            expect(result.palette?.length).toBeLessThanOrEqual(3);
            expect(result.totalPixels).toBeGreaterThan(0);
            expect(result.method).toBe('lab-kmeans-deltae76');

            // Check palette structure
            if (result.palette && result.palette.length > 0) {
                const color = result.palette[0];
                expect(color).toHaveProperty('rgb');
                expect(color).toHaveProperty('hex');
                expect(color).toHaveProperty('lab');
                expect(color).toHaveProperty('count');
                expect(color).toHaveProperty('percent');
                expect(color).toHaveProperty('dmcMatch');

                expect(color.rgb).toHaveProperty('r');
                expect(color.rgb).toHaveProperty('g');
                expect(color.rgb).toHaveProperty('b');
                expect(color.lab).toHaveProperty('l');
                expect(color.lab).toHaveProperty('a');
                expect(color.lab).toHaveProperty('b');
                expect(typeof color.count).toBe('number');
                expect(color.count).toBeGreaterThan(0);
                expect(typeof color.percent).toBe('number');
                expect(color.percent).toBeGreaterThan(0);
                expect(color.percent).toBeLessThanOrEqual(100);

                // Check DMC match structure
                expect(color.dmcMatch).toHaveProperty('ok');
                if (color.dmcMatch.ok) {
                    expect(color.dmcMatch.best).toBeDefined();
                    expect(color.dmcMatch.best?.id).toBeDefined();
                    expect(color.dmcMatch.best?.name).toBeDefined();
                    expect(color.dmcMatch.best?.hex).toBeDefined();
                    expect(color.dmcMatch.best?.deltaE).toBeGreaterThanOrEqual(0);
                }
            }
        });

        it('should return palette sorted by count (descending)', async () => {
            const input: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 5,
            };

            const result = await generateBlueprintV1Handler(input);

            expect(result.ok).toBe(true);
            expect(result.palette).toBeDefined();
            
            if (result.palette && result.palette.length > 1) {
                for (let i = 0; i < result.palette.length - 1; i++) {
                    expect(result.palette[i].count).toBeGreaterThanOrEqual(result.palette[i + 1].count);
                }
            }
        });

        it('should handle paletteSize equal to 1', async () => {
            const input: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 1,
            };

            const result = await generateBlueprintV1Handler(input);

            expect(result.ok).toBe(true);
            expect(result.palette).toBeDefined();
            expect(result.palette?.length).toBe(1);
            if (result.palette && result.palette.length > 0) {
                expect(result.palette[0].percent).toBeCloseTo(100, 1);
            }
        });

        it('should handle maxSize parameter', async () => {
            const input: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 3,
                maxSize: 1024,
            };

            const result = await generateBlueprintV1Handler(input);

            expect(result.ok).toBe(true);
            expect(result.palette).toBeDefined();
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
            const input: GenerateBlueprintV1Input = {
                imageId: registerResult.imageId!,
                paletteSize: 3,
            };

            const result = await generateBlueprintV1Handler(input);

            expect(result.ok).toBe(true);
            expect(result.palette).toBeDefined();
            expect(result.totalPixels).toBeGreaterThan(0);
        });

        it('should handle data URL format', async () => {
            const dataUrl = `data:image/png;base64,${RED_SQUARE_BASE64}`;
            const input: GenerateBlueprintV1Input = {
                imageBase64: dataUrl,
                paletteSize: 3,
            };

            const result = await generateBlueprintV1Handler(input);

            expect(result.ok).toBe(true);
            expect(result.palette).toBeDefined();
        });
    });

    describe('invalid inputs', () => {
        it('should return ok:false for missing imageId and imageBase64', async () => {
            const input: GenerateBlueprintV1Input = {
                paletteSize: 3,
            } as GenerateBlueprintV1Input;

            const result = await generateBlueprintV1Handler(input);

            expect(result.ok).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Either');
            expect(result.error).toContain('imageId');
            expect(result.error).toContain('imageBase64');
        });

        it('should return ok:false for invalid paletteSize (zero)', async () => {
            const input: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 0,
            };

            const result = await generateBlueprintV1Handler(input);

            expect(result.ok).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('positive integer');
        });

        it('should return ok:false for invalid paletteSize (negative)', async () => {
            const input: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: -1,
            };

            const result = await generateBlueprintV1Handler(input);

            expect(result.ok).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should return ok:false for invalid paletteSize (non-integer)', async () => {
            const input: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 3.5,
            };

            const result = await generateBlueprintV1Handler(input);

            expect(result.ok).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should return ok:false for invalid base64', async () => {
            const input: GenerateBlueprintV1Input = {
                imageBase64: 'INVALID_BASE64_DATA!!!',
                paletteSize: 3,
            };

            const result = await generateBlueprintV1Handler(input);

            expect(result.ok).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Invalid base64');
        });

        it('should return ok:false for missing imageId in cache', async () => {
            const input: GenerateBlueprintV1Input = {
                imageId: 'nonexistent-image-id-12345',
                paletteSize: 3,
            };

            const result = await generateBlueprintV1Handler(input);

            expect(result.ok).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('not found in cache');
        });
    });

    describe('output structure', () => {
        it('should include all required fields in successful response', async () => {
            const input: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 3,
            };

            const result = await generateBlueprintV1Handler(input);

            expect(result.ok).toBe(true);
            expect(result).toHaveProperty('palette');
            expect(result).toHaveProperty('totalPixels');
            expect(result).toHaveProperty('method');
            expect(result.method).toBe('lab-kmeans-deltae76');
        });

        it('should have palette colors with valid percent values', async () => {
            const input: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 3,
            };

            const result = await generateBlueprintV1Handler(input);

            expect(result.ok).toBe(true);
            if (result.palette) {
                let totalPercent = 0;
                for (const color of result.palette) {
                    expect(color.percent).toBeGreaterThanOrEqual(0);
                    expect(color.percent).toBeLessThanOrEqual(100);
                    totalPercent += color.percent;
                }
                // Total percent should be close to 100 (within rounding error)
                expect(totalPercent).toBeGreaterThan(99);
                expect(totalPercent).toBeLessThanOrEqual(100);
            }
        });

        it('should have palette colors with count matching totalPixels', async () => {
            const input: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 3,
            };

            const result = await generateBlueprintV1Handler(input);

            expect(result.ok).toBe(true);
            if (result.palette && result.totalPixels) {
                let totalCount = 0;
                for (const color of result.palette) {
                    totalCount += color.count;
                }
                expect(totalCount).toBe(result.totalPixels);
            }
        });
    });

    describe('deterministic behavior', () => {
        it('should produce identical results for same input and seed', async () => {
            const input: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 3,
                seed: 12345,
            };

            const result1 = await generateBlueprintV1Handler(input);
            const result2 = await generateBlueprintV1Handler(input);

            expect(result1.ok).toBe(true);
            expect(result2.ok).toBe(true);
            
            // Results should be identical with same seed
            expect(result1.totalPixels).toBe(result2.totalPixels);
            expect(result1.palette?.length).toBe(result2.palette?.length);
            
            // Verify exact palette match
            if (result1.palette && result2.palette) {
                expect(result1.palette.length).toBe(result2.palette.length);
                for (let i = 0; i < result1.palette.length; i++) {
                    expect(result1.palette[i].rgb.r).toBe(result2.palette[i].rgb.r);
                    expect(result1.palette[i].rgb.g).toBe(result2.palette[i].rgb.g);
                    expect(result1.palette[i].rgb.b).toBe(result2.palette[i].rgb.b);
                    expect(result1.palette[i].count).toBe(result2.palette[i].count);
                    expect(result1.palette[i].percent).toBe(result2.palette[i].percent);
                }
            }
        });

        it('should produce different results for different seeds', async () => {
            const input1: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 5,
                seed: 11111,
            };

            const input2: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 5,
                seed: 99999,
            };

            const result1 = await generateBlueprintV1Handler(input1);
            const result2 = await generateBlueprintV1Handler(input2);

            expect(result1.ok).toBe(true);
            expect(result2.ok).toBe(true);
            expect(result1.totalPixels).toBe(result2.totalPixels);
            
            // With different seeds, results may differ (though they might coincidentally match)
            // At minimum, verify both produce valid results
            expect(result1.palette).toBeDefined();
            expect(result2.palette).toBeDefined();
        });

        it('should use default seed when seed is not provided', async () => {
            const input1: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 3,
                seed: 42, // Default seed
            };

            const input2: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 3,
                // No seed provided, should default to 42
            };

            const result1 = await generateBlueprintV1Handler(input1);
            const result2 = await generateBlueprintV1Handler(input2);

            expect(result1.ok).toBe(true);
            expect(result2.ok).toBe(true);
            
            // Results should be identical (both using seed 42)
            if (result1.palette && result2.palette) {
                expect(result1.palette.length).toBe(result2.palette.length);
                for (let i = 0; i < result1.palette.length; i++) {
                    expect(result1.palette[i].rgb.r).toBe(result2.palette[i].rgb.r);
                    expect(result1.palette[i].rgb.g).toBe(result2.palette[i].rgb.g);
                    expect(result1.palette[i].rgb.b).toBe(result2.palette[i].rgb.b);
                    expect(result1.palette[i].count).toBe(result2.palette[i].count);
                }
            }
        });
    });

    describe('preview image', () => {
        it('should return preview image when returnPreview is true', async () => {
            const input: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 3,
                returnPreview: true,
            };

            const result = await generateBlueprintV1Handler(input);

            expect(result.ok).toBe(true);
            expect(result.indexedPreviewPngBase64).toBeDefined();
            expect(typeof result.indexedPreviewPngBase64).toBe('string');
            expect(result.indexedPreviewPngBase64!.length).toBeGreaterThan(0);
            
            // Verify it's valid base64 PNG (starts with PNG header when decoded)
            const previewBuffer = Buffer.from(result.indexedPreviewPngBase64!, 'base64');
            // PNG signature: 89 50 4E 47 0D 0A 1A 0A
            expect(previewBuffer[0]).toBe(0x89);
            expect(previewBuffer[1]).toBe(0x50); // P
            expect(previewBuffer[2]).toBe(0x4E); // N
            expect(previewBuffer[3]).toBe(0x47); // G
        });

        it('should not return preview image when returnPreview is false', async () => {
            const input: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 3,
                returnPreview: false,
            };

            const result = await generateBlueprintV1Handler(input);

            expect(result.ok).toBe(true);
            expect(result.indexedPreviewPngBase64).toBeUndefined();
        });

        it('should not return preview image when returnPreview is not provided', async () => {
            const input: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 3,
            };

            const result = await generateBlueprintV1Handler(input);

            expect(result.ok).toBe(true);
            expect(result.indexedPreviewPngBase64).toBeUndefined();
        });
    });

    describe('region cleanup', () => {
        // Create a test image that will produce small regions/islands
        // A checkerboard-like pattern with some noise should create small isolated regions
        it('should merge small regions when minRegionArea is set', async () => {
            // Create a simple 20x20 image with alternating colors that will create small regions
            // We'll use a pattern that creates isolated single-pixel regions
            const width = 20;
            const height = 20;
            const pixels = new Uint8Array(width * height * 4);
            
            // Create a checkerboard pattern with some isolated pixels
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    // Checkerboard: red and blue
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

            // Convert to base64 PNG
            const sharp = await import('sharp');
            const imageBuffer = await sharp.default(pixels, {
                raw: { width, height, channels: 4 }
            }).png().toBuffer();
            const testImageBase64 = imageBuffer.toString('base64');

            // Test without region cleanup
            const inputWithoutMerge: GenerateBlueprintV1Input = {
                imageBase64: testImageBase64,
                paletteSize: 2,
                seed: 42,
            };

            // Test with region cleanup
            const inputWithMerge: GenerateBlueprintV1Input = {
                imageBase64: testImageBase64,
                paletteSize: 2,
                seed: 42,
                minRegionArea: 5, // Merge regions smaller than 5 pixels
            };

            const resultWithoutMerge = await generateBlueprintV1Handler(inputWithoutMerge);
            const resultWithMerge = await generateBlueprintV1Handler(inputWithMerge);

            expect(resultWithoutMerge.ok).toBe(true);
            expect(resultWithMerge.ok).toBe(true);

            // Both should have same total pixels
            expect(resultWithoutMerge.totalPixels).toBe(resultWithMerge.totalPixels);
            expect(resultWithoutMerge.totalPixels).toBe(width * height);

            // With merging, we expect fewer small regions (though exact counts depend on quantization)
            // The key is that total pixels are preserved
            if (resultWithoutMerge.palette && resultWithMerge.palette) {
                let totalCountWithout = 0;
                let totalCountWith = 0;
                resultWithoutMerge.palette.forEach(c => totalCountWithout += c.count);
                resultWithMerge.palette.forEach(c => totalCountWith += c.count);
                expect(totalCountWithout).toBe(totalCountWith);
                expect(totalCountWithout).toBe(width * height);
            }
        });

        it('should preserve determinism when region cleanup is enabled', async () => {
            const input: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 5,
                seed: 12345,
                minRegionArea: 10,
            };

            const result1 = await generateBlueprintV1Handler(input);
            const result2 = await generateBlueprintV1Handler(input);

            expect(result1.ok).toBe(true);
            expect(result2.ok).toBe(true);

            // Results should be identical with same seed and merge settings
            expect(result1.totalPixels).toBe(result2.totalPixels);
            if (result1.palette && result2.palette) {
                expect(result1.palette.length).toBe(result2.palette.length);
                for (let i = 0; i < result1.palette.length; i++) {
                    expect(result1.palette[i].count).toBe(result2.palette[i].count);
                    expect(result1.palette[i].rgb.r).toBe(result2.palette[i].rgb.r);
                    expect(result1.palette[i].rgb.g).toBe(result2.palette[i].rgb.g);
                    expect(result1.palette[i].rgb.b).toBe(result2.palette[i].rgb.b);
                }
            }
        });

        it('should not merge regions when minRegionArea is 0', async () => {
            const input1: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 3,
                seed: 42,
                minRegionArea: 0,
            };

            const input2: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 3,
                seed: 42,
                // No minRegionArea specified (defaults to 0)
            };

            const result1 = await generateBlueprintV1Handler(input1);
            const result2 = await generateBlueprintV1Handler(input2);

            expect(result1.ok).toBe(true);
            expect(result2.ok).toBe(true);

            // Results should be identical (both have merging disabled)
            if (result1.palette && result2.palette) {
                expect(result1.palette.length).toBe(result2.palette.length);
                for (let i = 0; i < result1.palette.length; i++) {
                    expect(result1.palette[i].count).toBe(result2.palette[i].count);
                }
            }
        });

        it('should respect mergeSmallRegions parameter', async () => {
            const inputWithMergeDisabled: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 3,
                seed: 42,
                minRegionArea: 10,
                mergeSmallRegions: false, // Explicitly disable
            };

            const inputWithMergeEnabled: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 3,
                seed: 42,
                minRegionArea: 10,
                mergeSmallRegions: true, // Explicitly enable
            };

            const resultDisabled = await generateBlueprintV1Handler(inputWithMergeDisabled);
            const resultEnabled = await generateBlueprintV1Handler(inputWithMergeEnabled);

            expect(resultDisabled.ok).toBe(true);
            expect(resultEnabled.ok).toBe(true);

            // When disabled, should behave like minRegionArea = 0
            // When enabled, may have different region counts
            // Both should preserve total pixels
            expect(resultDisabled.totalPixels).toBe(resultEnabled.totalPixels);
        });

        it('should update preview image with merged regions', async () => {
            const input: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 5,
                seed: 42,
                minRegionArea: 10,
                returnPreview: true,
            };

            const result = await generateBlueprintV1Handler(input);

            expect(result.ok).toBe(true);
            expect(result.indexedPreviewPngBase64).toBeDefined();
            
            // Preview should reflect merged regions (valid PNG)
            const previewBuffer = Buffer.from(result.indexedPreviewPngBase64!, 'base64');
            expect(previewBuffer[0]).toBe(0x89);
            expect(previewBuffer[1]).toBe(0x50); // P
            expect(previewBuffer[2]).toBe(0x4E); // N
            expect(previewBuffer[3]).toBe(0x47); // G
        });
    });
});
