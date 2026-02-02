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
        it('should produce consistent results for same input', async () => {
            const input: GenerateBlueprintV1Input = {
                imageBase64: RED_SQUARE_BASE64,
                paletteSize: 3,
            };

            const result1 = await generateBlueprintV1Handler(input);
            const result2 = await generateBlueprintV1Handler(input);

            expect(result1.ok).toBe(true);
            expect(result2.ok).toBe(true);
            
            // Results should have same structure and counts
            expect(result1.totalPixels).toBe(result2.totalPixels);
            expect(result1.palette?.length).toBe(result2.palette?.length);
            
            // Note: k-means uses random initialization, so exact colors may differ
            // but structure and counts should be consistent
        });
    });
});
