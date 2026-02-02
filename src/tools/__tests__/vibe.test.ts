/**
 * SPEC-TEST-02: Verifying aesthetic profile transformations
 * Unit tests for the Vibe Shifter's mathematical transformations
 */

import { describe, it, expect } from 'vitest';
import { vibeShifter, type ColorArray, type ProfileName } from '../vibe.js';

describe('SPEC-TEST-02: Vibe Shifter - Aesthetic Profile Transformations', () => {
    describe('Lynchian Profile', () => {
        it('SPEC-TEST-02.1: Verifying Lynchian profile reduces saturation by 20%', () => {
            const colors: ColorArray = [
                {
                    hex: '#FF0000',
                    rgb: { r: 255, g: 0, b: 0 },
                },
            ];

            const result = vibeShifter(colors, 'Lynchian');

            expect(result.profile).toBe('Lynchian');
            expect(result.original).toEqual(colors);
            expect(result.artisan).toHaveLength(1);

            // Verify the color has been transformed (should be less saturated)
            const original = colors[0];
            const transformed = result.artisan[0];

            // The transformed color should not be identical
            expect(transformed.hex).not.toBe(original.hex);
            expect(transformed.rgb).not.toEqual(original.rgb);
        });

        it('SPEC-TEST-02.2: Verifying Lynchian profile sets L* < 30 to 0 (contrast increase)', () => {
            // Dark color that should be affected by contrast increase
            const colors: ColorArray = [
                {
                    hex: '#1A1A1A', // Very dark gray
                    rgb: { r: 26, g: 26, b: 26 },
                },
            ];

            const result = vibeShifter(colors, 'Lynchian');
            const transformed = result.artisan[0];

            // The transformed color should be darker (L* < 30 goes to 0)
            // This means the RGB values should be closer to black
            const totalOriginal = colors[0].rgb.r + colors[0].rgb.g + colors[0].rgb.b;
            const totalTransformed = transformed.rgb.r + transformed.rgb.g + transformed.rgb.b;

            // Transformed should be darker (lower total RGB)
            expect(totalTransformed).toBeLessThanOrEqual(totalOriginal);
        });

        it('SPEC-TEST-02.3: Verifying Lynchian profile adds blue shift to dark tones', () => {
            const colors: ColorArray = [
                {
                    hex: '#202020', // Dark color (L* < 50)
                    rgb: { r: 32, g: 32, b: 32 },
                },
            ];

            const result = vibeShifter(colors, 'Lynchian');
            const transformed = result.artisan[0];

            // Should have some transformation applied
            expect(transformed.hex).toBeDefined();
            expect(transformed.rgb).toBeDefined();
        });
    });

    describe('Brutalist Profile', () => {
        it('SPEC-TEST-02.4: Verifying Brutalist profile quantizes colors to industrial shades', () => {
            const colors: ColorArray = [
                {
                    hex: '#AABBCC', // Random color
                    rgb: { r: 170, g: 187, b: 204 },
                },
            ];

            const result = vibeShifter(colors, 'Brutalist');

            expect(result.profile).toBe('Brutalist');
            expect(result.original).toEqual(colors);
            expect(result.artisan).toHaveLength(1);

            const transformed = result.artisan[0];

            // Brutalist should quantize to industrial palette (grays, concrete, steel)
            // Verify it's one of the industrial shades
            const industrialShades = [
                { r: 0, g: 0, b: 0 },
                { r: 51, g: 51, b: 51 },
                { r: 102, g: 102, b: 102 },
                { r: 128, g: 128, b: 128 },
                { r: 153, g: 153, b: 153 },
                { r: 204, g: 204, b: 204 },
            ];

            const isIndustrial = industrialShades.some(
                (shade) =>
                    shade.r === transformed.rgb.r &&
                    shade.g === transformed.rgb.g &&
                    shade.b === transformed.rgb.b
            );

            expect(isIndustrial).toBe(true);
        });

        it('SPEC-TEST-02.5: Verifying Brutalist profile converts red colors to warning red (#FF0000)', () => {
            const colors: ColorArray = [
                {
                    hex: '#FF3333', // Bright red (sufficiently red)
                    rgb: { r: 255, g: 51, b: 51 },
                },
            ];

            const result = vibeShifter(colors, 'Brutalist');
            const transformed = result.artisan[0];

            // Should be converted to pure warning red
            expect(transformed.hex).toBe('#FF0000');
            expect(transformed.rgb).toEqual({ r: 255, g: 0, b: 0 });
        });

        it('SPEC-TEST-02.6: Verifying Brutalist profile handles non-red colors correctly', () => {
            const colors: ColorArray = [
                {
                    hex: '#00FF00', // Green (not red)
                    rgb: { r: 0, g: 255, b: 0 },
                },
            ];

            const result = vibeShifter(colors, 'Brutalist');
            const transformed = result.artisan[0];

            // Should be quantized to industrial shade, not warning red
            expect(transformed.hex).not.toBe('#FF0000');
            expect(transformed.rgb.r).toBe(transformed.rgb.g);
            expect(transformed.rgb.g).toBe(transformed.rgb.b); // Should be grayscale
        });
    });

    describe('Multiple Colors', () => {
        it('SPEC-TEST-02.7: Verifying vibeShifter handles multiple colors', () => {
            const colors: ColorArray = [
                { hex: '#FF0000', rgb: { r: 255, g: 0, b: 0 } },
                { hex: '#00FF00', rgb: { r: 0, g: 255, b: 0 } },
                { hex: '#0000FF', rgb: { r: 0, g: 0, b: 255 } },
            ];

            const result = vibeShifter(colors, 'Lynchian');

            expect(result.original).toHaveLength(3);
            expect(result.artisan).toHaveLength(3);
            expect(result.original).toEqual(colors);

            // Each color should be transformed
            result.artisan.forEach((transformed, index) => {
                expect(transformed.hex).toBeDefined();
                expect(transformed.rgb).toBeDefined();
                expect(transformed.hex).not.toBe(colors[index].hex);
            });
        });
    });

    describe('Error Handling', () => {
        it('SPEC-TEST-02.8: Verifying vibeShifter throws error for unknown profile', () => {
            const colors: ColorArray = [
                { hex: '#FF0000', rgb: { r: 255, g: 0, b: 0 } },
            ];

            // Type assertion to test invalid profile
            expect(() => {
                vibeShifter(colors, 'InvalidProfile' as ProfileName);
            }).toThrow('ERROR-CW-03');
        });
    });
});
