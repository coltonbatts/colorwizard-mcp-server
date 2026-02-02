/**
 * SPEC-TEST-01: Verifying spectral-to-DMC mapping accuracy
 * Unit tests for the Spectral Engine's core color distance calculations
 */

import { describe, it, expect } from 'vitest';
import { calculateDeltaE, ColorMatcher, type DMCThread } from '../spectral.js';

describe('SPEC-TEST-01: Spectral Engine - Delta E Calculation', () => {
    describe('calculateDeltaE - Identical Colors', () => {
        it('SPEC-TEST-01.1: Verifying identical colors return Delta E of 0', () => {
            const lab1 = { l: 50.0, a: 0.0, b: 0.0 };
            const lab2 = { l: 50.0, a: 0.0, b: 0.0 };
            const deltaE = calculateDeltaE(lab1, lab2);
            expect(deltaE).toBeCloseTo(0.0, 5);
        });

        it('SPEC-TEST-01.2: Verifying identical red colors have minimal Delta E', () => {
            // Bright red in LAB space (approximate)
            const redLab = { l: 53.24, a: 80.09, b: 67.20 };
            const deltaE = calculateDeltaE(redLab, redLab);
            expect(deltaE).toBeCloseTo(0.0, 5);
        });
    });

    describe('calculateDeltaE - Similar Colors', () => {
        it('SPEC-TEST-01.3: Verifying similar reds have low Delta E (< 2.0)', () => {
            // Two similar red colors
            const red1 = { l: 53.24, a: 80.09, b: 67.20 };
            const red2 = { l: 53.5, a: 80.5, b: 67.5 }; // Slightly different red
            const deltaE = calculateDeltaE(red1, red2);
            expect(deltaE).toBeLessThan(2.0);
            expect(deltaE).toBeGreaterThan(0.0);
        });

        it('SPEC-TEST-01.4: Verifying perceptually similar colors have Delta E < 1.0', () => {
            // Very similar shades of blue
            const blue1 = { l: 30.0, a: 20.0, b: -50.0 };
            const blue2 = { l: 30.2, a: 20.1, b: -50.1 };
            const deltaE = calculateDeltaE(blue1, blue2);
            expect(deltaE).toBeLessThan(1.0);
        });
    });

    describe('calculateDeltaE - Dissimilar Colors', () => {
        it('SPEC-TEST-01.5: Verifying red and blue have high Delta E (> 50)', () => {
            const red = { l: 53.24, a: 80.09, b: 67.20 };
            const blue = { l: 30.0, a: 20.0, b: -50.0 };
            const deltaE = calculateDeltaE(red, blue);
            expect(deltaE).toBeGreaterThan(50.0);
        });

        it('SPEC-TEST-01.6: Verifying white and black have very high Delta E (> 80)', () => {
            const white = { l: 100.0, a: 0.0, b: 0.0 };
            const black = { l: 0.0, a: 0.0, b: 0.0 };
            const deltaE = calculateDeltaE(white, black);
            expect(deltaE).toBeGreaterThan(80.0);
        });
    });

    describe('calculateDeltaE - Edge Cases', () => {
        it('SPEC-TEST-01.7: Verifying handling of achromatic colors (grays)', () => {
            const gray1 = { l: 50.0, a: 0.0, b: 0.0 };
            const gray2 = { l: 60.0, a: 0.0, b: 0.0 };
            const deltaE = calculateDeltaE(gray1, gray2);
            expect(deltaE).toBeGreaterThan(0.0);
            expect(deltaE).toBeLessThan(20.0); // Should be reasonable
        });

        it('SPEC-TEST-01.8: Verifying handling of very dark colors', () => {
            const dark1 = { l: 5.0, a: 0.0, b: 0.0 };
            const dark2 = { l: 5.5, a: 0.0, b: 0.0 };
            const deltaE = calculateDeltaE(dark1, dark2);
            expect(deltaE).toBeGreaterThan(0.0);
            expect(deltaE).toBeLessThan(5.0);
        });

        it('SPEC-TEST-01.9: Verifying handling of very light colors', () => {
            const light1 = { l: 95.0, a: 0.0, b: 0.0 };
            const light2 = { l: 96.0, a: 0.0, b: 0.0 };
            const deltaE = calculateDeltaE(light1, light2);
            expect(deltaE).toBeGreaterThan(0.0);
            expect(deltaE).toBeLessThan(5.0);
        });
    });

    describe('ColorMatcher - DMC Thread Matching', () => {
        it('SPEC-TEST-01.10: Verifying ColorMatcher finds nearest thread for red color', () => {
            const threads: DMCThread[] = [
                { id: '666', name: 'Bright Red', r: 255, g: 0, b: 0 },
                { id: '321', name: 'Christmas Red', r: 200, g: 0, b: 0 },
                { id: '384', name: 'Teal', r: 0, g: 128, b: 128 },
            ];

            const matcher = new ColorMatcher(threads);
            const matches = matcher.findNearest('#FF0000', 1);

            expect(matches).toHaveLength(1);
            expect(matches[0].thread.id).toBe('666'); // Should match Bright Red
            expect(matches[0].deltaE).toBeLessThan(5.0); // Should be very close
        });

        it('SPEC-TEST-01.11: Verifying ColorMatcher returns k nearest matches', () => {
            const threads: DMCThread[] = [
                { id: '666', name: 'Bright Red', r: 255, g: 0, b: 0 },
                { id: '321', name: 'Christmas Red', r: 200, g: 0, b: 0 },
                { id: '384', name: 'Teal', r: 0, g: 128, b: 128 },
            ];

            const matcher = new ColorMatcher(threads);
            const matches = matcher.findNearest('#FF0000', 2);

            expect(matches).toHaveLength(2);
            expect(matches[0].deltaE).toBeLessThanOrEqual(matches[1].deltaE); // Sorted ascending
            expect(matches[0].thread.id).toBe('666'); // Closest match
            expect(matches[1].thread.id).toBe('321'); // Second closest
        });

        it('SPEC-TEST-01.12: Verifying ColorMatcher handles hex without hash prefix', () => {
            const threads: DMCThread[] = [
                { id: '666', name: 'Bright Red', r: 255, g: 0, b: 0 },
            ];

            const matcher = new ColorMatcher(threads);
            const matches = matcher.findNearest('FF0000', 1);

            expect(matches).toHaveLength(1);
            expect(matches[0].thread.id).toBe('666');
        });
    });
});
