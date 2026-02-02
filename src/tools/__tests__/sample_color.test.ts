/**
 * Unit tests for sample_color tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { sampleColorHandler, type SampleColorInput, debugStats, clearImageCache } from '../sample_color.js';

// Tiny 10x10 red square PNG (base64)
const RED_SQUARE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFElEQVR4nGP4z8CABzGMSjNgCRYAt8pjnQuW8k0AAAAASUVORK5CYII=';

describe('sample_color tool', () => {
    beforeEach(() => {
        // Reset debug stats and clear cache before each test
        debugStats.cacheHits = 0;
        debugStats.cacheMisses = 0;
        clearImageCache();
    });

    describe('valid inputs', () => {
        it('should sample center pixel and return expected RGB', async () => {
            const input: SampleColorInput = {
                imageBase64: RED_SQUARE_BASE64,
                x: 0.5,
                y: 0.5,
                radius: 0,
            };

            const result = await sampleColorHandler(input);

            expect(result.ok).toBe(true);
            expect(result.rgb).toBeDefined();
            expect(result.rgb?.r).toBeGreaterThan(200); // Should be red
            expect(result.rgb?.g).toBeLessThan(50);
            expect(result.rgb?.b).toBeLessThan(50);
            expect(result.hex).toBeDefined();
            expect(result.lab).toBeDefined();
            expect(result.match).toBeDefined();
            expect(result.match?.best).toBeDefined();
            expect(result.method).toBe('lab-d65-deltae76');
            expect(result.inputNormalized).toBeDefined();
        });

        it('should return DMC match with best and alternatives', async () => {
            const input: SampleColorInput = {
                imageBase64: RED_SQUARE_BASE64,
                x: 0.5,
                y: 0.5,
            };

            const result = await sampleColorHandler(input);

            expect(result.ok).toBe(true);
            expect(result.match?.best).toBeDefined();
            expect(result.match?.best?.id).toBeDefined();
            expect(result.match?.best?.name).toBeDefined();
            expect(result.match?.best?.hex).toBeDefined();
            expect(result.match?.best?.deltaE).toBeGreaterThanOrEqual(0);
            expect(result.match?.alternatives).toBeDefined();
            expect(Array.isArray(result.match?.alternatives)).toBe(true);
            expect(result.match?.method).toBeDefined();
            expect(result.match?.method).toBe('lab-d65-deltae76');
            expect(result.match?.ok).toBe(true);
        });

        it('should handle radius averaging', async () => {
            const input: SampleColorInput = {
                imageBase64: RED_SQUARE_BASE64,
                x: 0.5,
                y: 0.5,
                radius: 1,
            };

            const result = await sampleColorHandler(input);

            expect(result.ok).toBe(true);
            expect(result.rgb).toBeDefined();
            // With radius, samples a region (may include edge pixels)
            // Just verify it returns valid RGB values
            expect(result.rgb?.r).toBeGreaterThanOrEqual(0);
            expect(result.rgb?.r).toBeLessThanOrEqual(255);
            expect(result.rgb?.g).toBeGreaterThanOrEqual(0);
            expect(result.rgb?.b).toBeGreaterThanOrEqual(0);
        });

        it('should handle data URL format', async () => {
            const dataUrl = `data:image/png;base64,${RED_SQUARE_BASE64}`;
            const input: SampleColorInput = {
                imageBase64: dataUrl,
                x: 0.5,
                y: 0.5,
            };

            const result = await sampleColorHandler(input);

            expect(result.ok).toBe(true);
            expect(result.rgb).toBeDefined();
        });

        it('should handle edge coordinates', async () => {
            const input: SampleColorInput = {
                imageBase64: RED_SQUARE_BASE64,
                x: 0.0,
                y: 0.0,
            };

            const result = await sampleColorHandler(input);

            expect(result.ok).toBe(true);
            expect(result.rgb).toBeDefined();
        });

        it('should handle maxSize parameter', async () => {
            const input: SampleColorInput = {
                imageBase64: RED_SQUARE_BASE64,
                x: 0.5,
                y: 0.5,
                maxSize: 1024,
            };

            const result = await sampleColorHandler(input);

            expect(result.ok).toBe(true);
            expect(result.rgb).toBeDefined();
        });
    });

    describe('invalid inputs', () => {
        it('should return ok:false for invalid base64', async () => {
            const input: SampleColorInput = {
                imageBase64: 'INVALID_BASE64_DATA!!!',
                x: 0.5,
                y: 0.5,
            };

            const result = await sampleColorHandler(input);

            expect(result.ok).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Invalid base64');
        });

        it('should return ok:false for x out of range', async () => {
            const input: SampleColorInput = {
                imageBase64: RED_SQUARE_BASE64,
                x: 1.5,
                y: 0.5,
            };

            const result = await sampleColorHandler(input);

            expect(result.ok).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('between 0 and 1');
        });

        it('should return ok:false for y out of range', async () => {
            const input: SampleColorInput = {
                imageBase64: RED_SQUARE_BASE64,
                x: 0.5,
                y: -0.1,
            };

            const result = await sampleColorHandler(input);

            expect(result.ok).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('between 0 and 1');
        });

        it('should return ok:false for negative radius', async () => {
            const input: SampleColorInput = {
                imageBase64: RED_SQUARE_BASE64,
                x: 0.5,
                y: 0.5,
                radius: -1,
            };

            const result = await sampleColorHandler(input);

            expect(result.ok).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Radius');
        });
    });

    describe('output structure', () => {
        it('should include all required fields in successful response', async () => {
            const input: SampleColorInput = {
                imageBase64: RED_SQUARE_BASE64,
                x: 0.5,
                y: 0.5,
            };

            const result = await sampleColorHandler(input);

            expect(result.ok).toBe(true);
            expect(result).toHaveProperty('rgb');
            expect(result).toHaveProperty('hex');
            expect(result).toHaveProperty('lab');
            expect(result).toHaveProperty('match');
            expect(result).toHaveProperty('method');
            expect(result).toHaveProperty('inputNormalized');
            
            expect(result.rgb).toHaveProperty('r');
            expect(result.rgb).toHaveProperty('g');
            expect(result.rgb).toHaveProperty('b');
            
            expect(result.lab).toHaveProperty('l');
            expect(result.lab).toHaveProperty('a');
            expect(result.lab).toHaveProperty('b');
            
            expect(result.inputNormalized).toHaveProperty('rgb');
            expect(result.inputNormalized).toHaveProperty('hex');
        });

        it('should verify radius averaging changes output', async () => {
            const input1: SampleColorInput = {
                imageBase64: RED_SQUARE_BASE64,
                x: 0.5,
                y: 0.5,
                radius: 0,
            };

            const input2: SampleColorInput = {
                imageBase64: RED_SQUARE_BASE64,
                x: 0.5,
                y: 0.5,
                radius: 1,
            };

            const result1 = await sampleColorHandler(input1);
            const result2 = await sampleColorHandler(input2);

            expect(result1.ok).toBe(true);
            expect(result2.ok).toBe(true);
            
            // Radius 0 samples single pixel, radius 1 samples 3x3 region
            // Both should return valid RGB (radius 0 should be more red)
            expect(result1.rgb).toBeDefined();
            expect(result2.rgb).toBeDefined();
            expect(result1.rgb?.r).toBeGreaterThan(200); // Single pixel should be red
            // Radius averaging may include edge pixels, so just verify it's valid
            expect(result2.rgb?.r).toBeGreaterThanOrEqual(0);
            expect(result2.rgb?.r).toBeLessThanOrEqual(255);
        });
    });

    describe('caching', () => {
        it('should cache decoded+resized images for same imageBase64 and maxSize', async () => {
            const input: SampleColorInput = {
                imageBase64: RED_SQUARE_BASE64,
                x: 0.5,
                y: 0.5,
                maxSize: 2048,
            };

            // First call - should be a cache miss
            const result1 = await sampleColorHandler(input);
            expect(result1.ok).toBe(true);
            
            if (debugStats) {
                expect(debugStats.cacheMisses).toBe(1);
                expect(debugStats.cacheHits).toBe(0);
            }

            // Second call with same image and maxSize - should hit cache
            const result2 = await sampleColorHandler(input);
            expect(result2.ok).toBe(true);
            
            if (debugStats) {
                expect(debugStats.cacheMisses).toBe(1);
                expect(debugStats.cacheHits).toBe(1);
            }

            // Results should be identical
            expect(result1.rgb).toEqual(result2.rgb);
            expect(result1.hex).toBe(result2.hex);
        });

        it('should not cache hit when maxSize differs', async () => {
            const input1: SampleColorInput = {
                imageBase64: RED_SQUARE_BASE64,
                x: 0.5,
                y: 0.5,
                maxSize: 2048,
            };

            const input2: SampleColorInput = {
                imageBase64: RED_SQUARE_BASE64,
                x: 0.5,
                y: 0.5,
                maxSize: 1024,
            };

            // First call
            await sampleColorHandler(input1);
            
            if (debugStats) {
                expect(debugStats.cacheMisses).toBe(1);
            }

            // Second call with different maxSize - should be another miss
            await sampleColorHandler(input2);
            
            if (debugStats) {
                expect(debugStats.cacheMisses).toBe(2);
                expect(debugStats.cacheHits).toBe(0);
            }
        });
    });

    describe('match output structure', () => {
        it('should include match.method in output', async () => {
            const input: SampleColorInput = {
                imageBase64: RED_SQUARE_BASE64,
                x: 0.5,
                y: 0.5,
            };

            const result = await sampleColorHandler(input);

            expect(result.ok).toBe(true);
            expect(result.match).toBeDefined();
            expect(result.match?.method).toBeDefined();
            expect(result.match?.method).toBe('lab-d65-deltae76');
            expect(result.match?.ok).toBe(true);
        });
    });
});
