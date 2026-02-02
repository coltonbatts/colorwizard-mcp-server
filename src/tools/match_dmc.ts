/**
 * Instrument CW-02: DMC Thread Matching
 * Physical Material Matching Engine
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { deltaE76Rgb, type RGB } from "../lib/color/lab.js";

export interface MatchDmcInput {
    rgb?: {
        r: number;
        g: number;
        b: number;
    };
    hex?: string;
}

export interface DmcMatch {
    id: string;
    name: string;
    hex: string;
    deltaE: number;
}

export interface MatchDmcOutput {
    ok: boolean;
    best?: DmcMatch;
    alternatives?: DmcMatch[];
    error?: string;
}

/**
 * Converts hex string to RGB
 * @param hex - Hex color string (with or without #)
 * @returns RGB object or null if invalid
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const cleaned = hex.replace(/^#/, "");
    if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) {
        return null;
    }
    const r = parseInt(cleaned.substring(0, 2), 16);
    const g = parseInt(cleaned.substring(2, 4), 16);
    const b = parseInt(cleaned.substring(4, 6), 16);
    return { r, g, b };
}


/**
 * DMC thread entry from dataset
 */
interface DmcDatasetEntry {
    id: string;
    name: string;
    hex: string;
}

/**
 * Loads DMC dataset from JSON file
 * @returns DMC thread data with RGB values or null if file doesn't exist
 */
function loadDmcDataset(): Array<{ id: string; name: string; hex: string; rgb: RGB }> | null {
    // Resolve path relative to project root (src/data/dmc.json)
    const dataPath = resolve(process.cwd(), "src/data/dmc.json");
    
    if (!existsSync(dataPath)) {
        return null;
    }
    
    try {
        const fileContent = readFileSync(dataPath, "utf-8");
        const entries: DmcDatasetEntry[] = JSON.parse(fileContent);
        
        // Convert hex to RGB for each entry
        return entries.map((entry) => {
            const rgb = hexToRgb(entry.hex);
            if (!rgb) {
                throw new Error(`Invalid hex color in dataset: ${entry.hex} for ${entry.id}`);
            }
            return {
                id: entry.id,
                name: entry.name,
                hex: entry.hex,
                rgb,
            };
        });
    } catch (error) {
        console.error("Failed to load DMC dataset:", error);
        return null;
    }
}

/**
 * Matches a color to the nearest DMC thread
 * @param input - Color input (either RGB or hex)
 * @returns MatchDmcOutput with best match and alternatives
 */
export function matchDmcHandler(input: MatchDmcInput): MatchDmcOutput {
    // Validate input - must have either rgb or hex
    if (!input.rgb && !input.hex) {
        return {
            ok: false,
            error: "Either 'rgb' or 'hex' must be provided",
        };
    }

    // Normalize to RGB
    let targetRgb: { r: number; g: number; b: number };
    if (input.rgb) {
        targetRgb = input.rgb;
    } else if (input.hex) {
        const rgb = hexToRgb(input.hex);
        if (!rgb) {
            return {
                ok: false,
                error: "Invalid hex color format. Expected 6-character hex (e.g., #FFFFFF or FFFFFF)",
            };
        }
        targetRgb = rgb;
    } else {
        return {
            ok: false,
            error: "Either 'rgb' or 'hex' must be provided",
        };
    }

    // Try to load DMC dataset
    const dmcDataset = loadDmcDataset();
    if (!dmcDataset) {
        return {
            ok: false,
            error: "DMC dataset not found. Expected dataset at src/data/dmc.json",
        };
    }

    // Normalize RGB values to 0-255 range
    const normalizedRgb: RGB = {
        r: Math.max(0, Math.min(255, Math.round(targetRgb.r))),
        g: Math.max(0, Math.min(255, Math.round(targetRgb.g))),
        b: Math.max(0, Math.min(255, Math.round(targetRgb.b))),
    };

    // Calculate Delta E for all threads and find best match
    const matches: Array<{ id: string; name: string; hex: string; deltaE: number }> = dmcDataset.map((thread) => {
        const deltaE = deltaE76Rgb(normalizedRgb, thread.rgb);
        return {
            id: thread.id,
            name: thread.name,
            hex: thread.hex,
            deltaE: Math.round(deltaE * 100) / 100, // Round to 2 decimal places
        };
    });

    // Sort by Delta E (lower is better)
    matches.sort((a, b) => a.deltaE - b.deltaE);

    // Return best match and top 5 alternatives
    const best = matches[0];
    const alternatives = matches.slice(1, 6);

    return {
        ok: true,
        best,
        alternatives,
    };
}

/**
 * Match DMC tool definition for MCP
 */
export const matchDmcTool = {
    name: "match_dmc",
    description: "Matches a color (RGB or hex) to the nearest DMC embroidery thread with Delta E calculation",
    inputSchema: {
        type: "object",
        properties: {
            rgb: {
                type: "object",
                description: "RGB color object",
                properties: {
                    r: { type: "number", description: "Red component (0-255)" },
                    g: { type: "number", description: "Green component (0-255)" },
                    b: { type: "number", description: "Blue component (0-255)" },
                },
                required: ["r", "g", "b"],
            },
            hex: {
                type: "string",
                description: "Hex color code (e.g., #FFFFFF or FFFFFF)",
                pattern: "^#?[0-9a-fA-F]{6}$",
            },
        },
    },
};
