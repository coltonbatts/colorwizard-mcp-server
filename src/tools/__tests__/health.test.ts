/**
 * Unit tests for health tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { healthHandler, type HealthOutput } from '../health.js';
import { clearImageCache, debugStats } from '../sample_color.js';

describe('health tool', () => {
    beforeEach(() => {
        // Reset cache and stats before each test
        clearImageCache();
        debugStats.cacheHits = 0;
        debugStats.cacheMisses = 0;
    });

    describe('health handler', () => {
        it('should return health status with all required fields', () => {
            const result = healthHandler();

            expect(result.ok).toBe(true);
            expect(result.version).toBeDefined();
            expect(typeof result.version).toBe('string');
            expect(result.uptimeSec).toBeGreaterThanOrEqual(0);
            expect(typeof result.uptimeSec).toBe('number');
            expect(result.toolCount).toBeGreaterThan(0);
            expect(typeof result.toolCount).toBe('number');
            expect(result.datasets).toBeDefined();
            expect(typeof result.datasets.dmc).toBe('boolean');
            expect(result.cache).toBeDefined();
            expect(typeof result.cache.images).toBe('number');
            expect(typeof result.cache.hits).toBe('number');
            expect(typeof result.cache.misses).toBe('number');
        });

        it('should return correct output structure', () => {
            const result = healthHandler();

            // Verify structure matches HealthOutput interface
            const expectedKeys: (keyof HealthOutput)[] = [
                'ok',
                'version',
                'uptimeSec',
                'toolCount',
                'datasets',
                'cache',
            ];

            expectedKeys.forEach((key) => {
                expect(result).toHaveProperty(key);
            });

            // Verify nested structures
            expect(result.datasets).toHaveProperty('dmc');
            expect(result.cache).toHaveProperty('images');
            expect(result.cache).toHaveProperty('hits');
            expect(result.cache).toHaveProperty('misses');
        });

        it('should return ok: true', () => {
            const result = healthHandler();
            expect(result.ok).toBe(true);
        });

        it('should return version string', () => {
            const result = healthHandler();
            expect(result.version).toBeTruthy();
            expect(result.version).not.toBe('');
        });

        it('should return non-negative uptime', () => {
            const result = healthHandler();
            expect(result.uptimeSec).toBeGreaterThanOrEqual(0);
        });

        it('should return tool count greater than zero', () => {
            const result = healthHandler();
            expect(result.toolCount).toBeGreaterThan(0);
        });

        it('should return cache statistics', () => {
            const result = healthHandler();
            
            expect(result.cache.images).toBeGreaterThanOrEqual(0);
            expect(result.cache.hits).toBeGreaterThanOrEqual(0);
            expect(result.cache.misses).toBeGreaterThanOrEqual(0);
        });

        it('should return DMC dataset status', () => {
            const result = healthHandler();
            
            // DMC dataset should be loaded if dmc.json exists
            expect(typeof result.datasets.dmc).toBe('boolean');
        });

        it('should reflect cache state changes', () => {
            // Initial state
            const result1 = healthHandler();
            const initialMisses = result1.cache.misses;
            
            // After some cache operations (simulated via direct stat updates)
            debugStats.cacheMisses = 5;
            debugStats.cacheHits = 3;
            
            const result2 = healthHandler();
            expect(result2.cache.misses).toBe(5);
            expect(result2.cache.hits).toBe(3);
        });

        it('should return cache images count', () => {
            const result = healthHandler();
            expect(result.cache.images).toBe(0); // Cache should be empty after beforeEach
        });
    });
});
