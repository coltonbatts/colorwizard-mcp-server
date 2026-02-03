/**
 * Tools aggregator - Exports all tool definitions and handlers
 */

import { pingTool, pingHandler, type PingInput } from "./ping.js";
import { matchDmcTool, matchDmcHandler, type MatchDmcInput } from "./match_dmc.js";
import { sampleColorTool, sampleColorHandler, type SampleColorInput, imageRegisterTool, imageRegisterHandler, type ImageRegisterInput } from "./sample_color.js";
import { healthTool, healthHandler } from "./health.js";
import { analyzeImageRegion } from "./vision.js";
import { vibeShifter, type ColorArray } from "./vibe.js";
import { generateStitchPattern } from "./pattern.js";
import { generateBlueprint } from "../lib/blueprint/generateBlueprint.js";
import { generateBlueprintV1Tool, generateBlueprintV1Handler, type GenerateBlueprintV1Input } from "./generate_blueprint_v1.js";
import { generateBlueprintV2Tool, generateBlueprintV2Handler, type GenerateBlueprintV2Input } from "./generate_blueprint_v2.js";

/**
 * Tool definition type
 */
export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties?: Record<string, unknown>;
        required?: string[];
    };
}

/**
 * All tool definitions
 */
export const tools: ToolDefinition[] = [
    pingTool,
    healthTool,
    matchDmcTool,
    imageRegisterTool,
    sampleColorTool,
    {
        name: "analyze_image_region",
        description: "Extracts precise pixel data from a local image file at specified coordinates.",
        inputSchema: {
            type: "object",
            properties: {
                image_path: {
                    type: "string",
                    description: "Path to the image file",
                },
                x: {
                    type: "number",
                    description: "X coordinate of the region center",
                },
                y: {
                    type: "number",
                    description: "Y coordinate of the region center",
                },
                radius: {
                    type: "number",
                    description: "Radius of the square region (default: 5)",
                    default: 5,
                },
            },
            required: ["image_path", "x", "y"],
        },
    },
    {
        name: "apply_aesthetic_offset",
        description: "Modifies an input color array to match specific aesthetic profiles (Lynchian, Southern Gothic, Brutalist).",
        inputSchema: {
            type: "object",
            properties: {
                colors: {
                    type: "array",
                    description: "Array of color objects with hex and rgb properties",
                    items: {
                        type: "object",
                        properties: {
                            hex: {
                                type: "string",
                                description: "6-character hex color code (e.g., #FFFFFF)",
                            },
                            rgb: {
                                type: "object",
                                properties: {
                                    r: { type: "number", description: "Red component (0-255)" },
                                    g: { type: "number", description: "Green component (0-255)" },
                                    b: { type: "number", description: "Blue component (0-255)" },
                                },
                                required: ["r", "g", "b"],
                            },
                        },
                        required: ["hex", "rgb"],
                    },
                },
                profile_name: {
                    type: "string",
                    description: "Aesthetic profile to apply",
                    enum: ["Lynchian", "Southern Gothic", "Brutalist"],
                },
            },
            required: ["colors", "profile_name"],
        },
    },
    {
        name: "generate_stitch_pattern",
        description: "Transforms a raw image into a symbol-coded cross-stitch grid with matching DMC manifest. Supports optional aesthetic profile application (CW-03).",
        inputSchema: {
            type: "object",
            properties: {
                image_path: {
                    type: "string",
                    description: "Path to local image file",
                },
                hoop_size_inches: {
                    type: "number",
                    description: "Hoop size in inches (e.g., 5, 8, or 10)",
                },
                fabric_count: {
                    type: "number",
                    description: "Stitches per inch (default: 14)",
                    default: 14,
                },
                max_colors: {
                    type: "number",
                    description: "Maximum number of DMC threads to use",
                    default: 50,
                },
                aesthetic_profile: {
                    type: "string",
                    description: "Optional aesthetic profile to apply: 'Lynchian', 'Southern Gothic', or 'Brutalist'",
                    enum: ["Lynchian", "Southern Gothic", "Brutalist"],
                },
            },
            required: ["image_path", "hoop_size_inches"],
        },
    },
    {
        name: "generate_blueprint",
        description: "Transforms an input image into a vector paint-by-number SVG blueprint (Instrument CW-05).",
        inputSchema: {
            type: "object",
            properties: {
                image_path: {
                    type: "string",
                    description: "Path to the local image file",
                },
                num_colors: {
                    type: "number",
                    description: "Number of color clusters (default: 12)",
                    default: 12,
                },
                min_area: {
                    type: "number",
                    description: "Minimum region area in pixels (default: 100)",
                    default: 100,
                },
                epsilon: {
                    type: "number",
                    description: "RDP simplification tolerance (default: 1.0)",
                    default: 1.0,
                },
                max_dim: {
                    type: "number",
                    description: "Maximum dimension for processing (default: 1024)",
                    default: 1024,
                },
            },
            required: ["image_path"],
        },
    },
    generateBlueprintV1Tool,
    generateBlueprintV2Tool,
];

/**
 * Tool handler function type
 */
export type ToolHandler = (args: unknown) => Promise<unknown> | unknown;

/**
 * Map of tool names to their handlers
 */
export const toolHandlers: Record<string, ToolHandler> = {
    ping: (args: unknown) => pingHandler(args as PingInput),
    health: (_args: unknown) => healthHandler(),
    match_dmc: (args: unknown) => matchDmcHandler(args as MatchDmcInput),
    image_register: async (args: unknown) => {
        return await imageRegisterHandler(args as ImageRegisterInput);
    },
    sample_color: async (args: unknown) => {
        const { imageId, imageBase64, x, y, radius, maxSize } = args as SampleColorInput;
        return await sampleColorHandler({ imageId, imageBase64, x, y, radius, maxSize });
    },
    analyze_image_region: async (args: unknown) => {
        const { image_path, x, y, radius } = args as {
            image_path: string;
            x: number;
            y: number;
            radius?: number;
        };
        return await analyzeImageRegion(image_path, x, y, radius);
    },
    apply_aesthetic_offset: (args: unknown) => {
        const { colors, profile_name } = args as {
            colors: ColorArray;
            profile_name: "Lynchian" | "Southern Gothic" | "Brutalist";
        };
        return vibeShifter(colors, profile_name);
    },
    generate_stitch_pattern: async (args: unknown) => {
        const { image_path, hoop_size_inches, fabric_count, max_colors, aesthetic_profile } = args as {
            image_path: string;
            hoop_size_inches: number;
            fabric_count?: number;
            max_colors?: number;
            aesthetic_profile?: "Lynchian" | "Southern Gothic" | "Brutalist";
        };
        return await generateStitchPattern(
            image_path,
            hoop_size_inches,
            fabric_count,
            max_colors,
            aesthetic_profile
        );
    },
    generate_blueprint: async (args: unknown) => {
        const { image_path, num_colors, min_area, epsilon, max_dim } = args as {
            image_path: string;
            num_colors?: number;
            min_area?: number;
            epsilon?: number;
            max_dim?: number;
        };
        return await generateBlueprint({
            imagePath: image_path,
            numColors: num_colors,
            minArea: min_area,
            epsilon,
            maxDim: max_dim,
        });
    },
    generate_blueprint_v1: async (args: unknown) => {
        return await generateBlueprintV1Handler(args as GenerateBlueprintV1Input);
    },
    generate_blueprint_v2: async (args: unknown) => {
        return await generateBlueprintV2Handler(args as GenerateBlueprintV2Input);
    },
};
