/**
 * Simple seeded pseudo-random number generator
 * Uses a linear congruential generator (LCG) for deterministic randomness
 */

export class SeededRNG {
    private seed: number;

    constructor(seed: number) {
        // Ensure seed is a positive integer
        this.seed = Math.floor(Math.abs(seed)) || 1;
    }

    /**
     * Returns a random number between 0 (inclusive) and 1 (exclusive)
     */
    random(): number {
        // LCG parameters (from Numerical Recipes)
        this.seed = (this.seed * 1664525 + 1013904223) % Math.pow(2, 32);
        return (this.seed >>> 0) / Math.pow(2, 32);
    }

    /**
     * Returns a random integer between min (inclusive) and max (exclusive)
     */
    randomInt(min: number, max: number): number {
        return Math.floor(this.random() * (max - min)) + min;
    }

    /**
     * Returns a random integer between 0 (inclusive) and max (exclusive)
     */
    randomIntMax(max: number): number {
        return Math.floor(this.random() * max);
    }
}
