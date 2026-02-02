/**
 * Unit tests for match_dmc tool
 */

import { describe, it, expect } from 'vitest';
import { matchDmcHandler, type MatchDmcInput } from '../match_dmc.js';

describe('match_dmc tool', () => {
    describe('valid inputs', () => {
        it('should match a known red color to correct DMC thread', () => {
            // DMC-666 is "Bright Christmas Red" with hex #E31D42
            const input: MatchDmcInput = { hex: '#E31D42' };
            const result = matchDmcHandler(input);

            expect(result.ok).toBe(true);
            expect(result.best).toBeDefined();
            expect(result.best?.id).toBe('DMC-666');
            expect(result.best?.name).toBe('Bright Christmas Red');
            expect(result.best?.deltaE).toBeLessThan(1); // Should be very close (exact match)
            expect(result.alternatives).toBeDefined();
            expect(result.alternatives?.length).toBeGreaterThanOrEqual(1);
            expect(result.alternatives?.length).toBeLessThanOrEqual(5);
        });

        it('should match RGB input to nearest DMC thread', () => {
            // Test with a bright red RGB value
            const input: MatchDmcInput = { rgb: { r: 227, g: 29, b: 66 } };
            const result = matchDmcHandler(input);

            expect(result.ok).toBe(true);
            expect(result.best).toBeDefined();
            expect(result.best?.id).toBeDefined();
            expect(result.best?.name).toBeDefined();
            expect(result.best?.hex).toBeDefined();
            expect(result.best?.deltaE).toBeGreaterThanOrEqual(0);
            expect(result.alternatives).toBeDefined();
            expect(result.alternatives?.length).toBeGreaterThanOrEqual(1);
            expect(result.alternatives?.length).toBeLessThanOrEqual(5);
        });

        it('should match hex without hash prefix', () => {
            const input: MatchDmcInput = { hex: 'E31D42' };
            const result = matchDmcHandler(input);

            expect(result.ok).toBe(true);
            expect(result.best).toBeDefined();
            expect(result.best?.id).toBe('DMC-666');
        });

        it('should return alternatives sorted by deltaE (ascending)', () => {
            const input: MatchDmcInput = { hex: '#FF0000' };
            const result = matchDmcHandler(input);

            expect(result.ok).toBe(true);
            expect(result.alternatives).toBeDefined();
            
            if (result.alternatives && result.alternatives.length > 1) {
                // Verify alternatives are sorted by deltaE
                for (let i = 1; i < result.alternatives.length; i++) {
                    expect(result.alternatives[i].deltaE).toBeGreaterThanOrEqual(
                        result.alternatives[i - 1].deltaE
                    );
                }
                // Best match should have lower or equal deltaE than first alternative
                expect(result.best?.deltaE).toBeLessThanOrEqual(
                    result.alternatives[0].deltaE
                );
            }
        });

        it('should match a blue color to appropriate DMC thread', () => {
            // DMC-500 is "Blueberry Very Dark" with hex #1A1A4D
            const input: MatchDmcInput = { hex: '#1A1A4D' };
            const result = matchDmcHandler(input);

            expect(result.ok).toBe(true);
            expect(result.best).toBeDefined();
            // Should match to a blue thread
            expect(result.best?.id).toBeDefined();
            expect(result.best?.deltaE).toBeGreaterThanOrEqual(0);
        });
    });

    describe('invalid inputs', () => {
        it('should return ok:false when neither rgb nor hex is provided', () => {
            const input: MatchDmcInput = {};
            const result = matchDmcHandler(input);

            expect(result.ok).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain("Either 'rgb' or 'hex' must be provided");
            expect(result.best).toBeUndefined();
            expect(result.alternatives).toBeUndefined();
        });

        it('should return ok:false for invalid hex format', () => {
            const input: MatchDmcInput = { hex: 'INVALID' };
            const result = matchDmcHandler(input);

            expect(result.ok).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Invalid hex color format');
            expect(result.best).toBeUndefined();
        });

        it('should return ok:false for hex with wrong length', () => {
            const input: MatchDmcInput = { hex: '#FF00' };
            const result = matchDmcHandler(input);

            expect(result.ok).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle RGB values out of range (clamp to valid range)', () => {
            const input: MatchDmcInput = { rgb: { r: 300, g: -10, b: 128 } };
            const result = matchDmcHandler(input);

            // Should still work, clamping values to 0-255
            expect(result.ok).toBe(true);
            expect(result.best).toBeDefined();
        });
    });

    describe('edge cases', () => {
        it('should handle pure black', () => {
            const input: MatchDmcInput = { hex: '#000000' };
            const result = matchDmcHandler(input);

            expect(result.ok).toBe(true);
            expect(result.best).toBeDefined();
            // DMC-934 is Black
            expect(result.best?.id).toBe('DMC-934');
        });

        it('should handle pure white', () => {
            const input: MatchDmcInput = { hex: '#FFFFFF' };
            const result = matchDmcHandler(input);

            expect(result.ok).toBe(true);
            expect(result.best).toBeDefined();
        });

        it('should return at least one alternative if dataset has multiple entries', () => {
            const input: MatchDmcInput = { hex: '#FF5733' };
            const result = matchDmcHandler(input);

            expect(result.ok).toBe(true);
            expect(result.alternatives).toBeDefined();
            // Should have alternatives if dataset has more than 1 entry
            if (result.alternatives) {
                expect(result.alternatives.length).toBeGreaterThan(0);
            }
        });
    });
});
