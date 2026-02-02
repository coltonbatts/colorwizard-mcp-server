/**
 * Health check tool - Returns server status and metrics
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { debugStats, getImageCacheSize } from "./sample_color.js";
import { isDmcDatasetLoaded } from "./match_dmc.js";
import { tools } from "./index.js";

export interface HealthOutput {
    ok: true;
    version: string;
    uptimeSec: number;
    toolCount: number;
    datasets: {
        dmc: boolean;
    };
    cache: {
        images: number;
        hits: number;
        misses: number;
    };
}

// Track server start time
const startTime = Date.now();

/**
 * Get version from package.json or environment variable
 */
function getVersion(): string {
    // Try environment variable first
    if (process.env.VERSION) {
        return process.env.VERSION;
    }

    // Try to read from package.json
    try {
        const packagePath = resolve(process.cwd(), "package.json");
        const packageJson = JSON.parse(readFileSync(packagePath, "utf-8"));
        return packageJson.version || "unknown";
    } catch {
        return "unknown";
    }
}

/**
 * Health check handler - Returns server status and metrics
 * @returns HealthOutput with server information
 */
export function healthHandler(): HealthOutput {
    const uptimeSec = Math.floor((Date.now() - startTime) / 1000);

    return {
        ok: true,
        version: getVersion(),
        uptimeSec,
        toolCount: tools.length,
        datasets: {
            dmc: isDmcDatasetLoaded(),
        },
        cache: {
            images: getImageCacheSize(),
            hits: debugStats.cacheHits,
            misses: debugStats.cacheMisses,
        },
    };
}

/**
 * Health tool definition for MCP
 */
export const healthTool = {
    name: "health",
    description: "Returns server health status including version, uptime, tool count, dataset availability, and cache statistics",
    inputSchema: {
        type: "object",
        properties: {},
    },
};
