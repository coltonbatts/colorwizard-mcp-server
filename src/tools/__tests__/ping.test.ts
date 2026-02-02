/**
 * Smoke test for ping tool
 * Verifies ping handler works correctly with direct calls
 */

import { describe, it, expect } from 'vitest';
import { pingHandler, type PingInput } from '../ping.js';

describe('ping tool smoke test', () => {
    it('should return ok: true, echo, and timestamp with default message', () => {
        const result = pingHandler();

        expect(result).toBeDefined();
        expect(result.ok).toBe(true);
        expect(result.echo).toBe('pong');
        expect(result.timestamp).toBeDefined();
        expect(typeof result.timestamp).toBe('string');
        expect(new Date(result.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('should echo custom message when provided', () => {
        const input: PingInput = { message: 'hello world' };
        const result = pingHandler(input);

        expect(result.ok).toBe(true);
        expect(result.echo).toBe('hello world');
        expect(result.timestamp).toBeDefined();
    });

    it('should return valid ISO timestamp', () => {
        const result = pingHandler();
        const timestamp = new Date(result.timestamp);

        expect(timestamp.toISOString()).toBe(result.timestamp);
        expect(timestamp.getTime()).toBeGreaterThan(Date.now() - 1000); // Within last second
    });

    it('should have all required output keys', () => {
        const result = pingHandler();

        expect(result).toHaveProperty('ok');
        expect(result).toHaveProperty('echo');
        expect(result).toHaveProperty('timestamp');
    });
});
