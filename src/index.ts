import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { analyzeImageRegion } from "./tools/vision.js";
import { vibeShifter, type ColorArray } from "./tools/vibe.js";
import { generateStitchPattern } from "./tools/pattern.js";
import { generateBlueprint } from "./lib/blueprint/generateBlueprint.js";

/**
 * ColorWizard MCP Server
 * Perceptual Thread Matching Instrument
 */
export class ColorWizardServer {
    private server: Server;

    constructor() {
        this.server = new Server(
            {
                name: "colorwizard-mcp",
                version: "1.0.0",
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.setupToolHandlers();

        // Error handling
        this.server.onerror = (error) => console.error("[MCP Error]", error);

        // Only set up SIGINT handler if not in test environment
        if (process.env.NODE_ENV !== 'test' && typeof process.env.VITEST === 'undefined') {
            process.on("SIGINT", async () => {
                await this.server.close();
                process.exit(0);
            });
        }
    }

    private setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
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
                    name: "match_dmc_thread",
                    description: "Matches a hex color value to the nearest physical DMC embroidery thread.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            hex: {
                                type: "string",
                                description: "The 6-character hex color code (e.g., #FFFFFF)",
                                pattern: "^#?[0-9a-fA-F]{6}$",
                            },
                        },
                        required: ["hex"],
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
            ],
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const toolName = request.params.name;

            if (toolName === "analyze_image_region") {
                const schema = z.object({
                    image_path: z.string(),
                    x: z.number(),
                    y: z.number(),
                    radius: z.number().optional().default(5),
                });

                const parseResult = schema.safeParse(request.params.arguments);
                if (!parseResult.success) {
                    throw new McpError(
                        ErrorCode.InvalidParams,
                        "Invalid parameters for analyze_image_region"
                    );
                }

                const { image_path, x, y, radius } = parseResult.data;

                try {
                    const result = await analyzeImageRegion(
                        image_path,
                        x,
                        y,
                        radius
                    );

                    return {
                        content: [
                            {
                                type: "text",
                                text: `Instrument CW-01 (Spectral Analysis) invoked for image ${image_path} at coordinates (${x}, ${y}) with radius ${radius}. Region analysis complete. HEX: ${result.hex}, RGB: (${result.rgb.r}, ${result.rgb.g}, ${result.rgb.b}).`,
                            },
                        ],
                    };
                } catch (error) {
                    if (
                        error instanceof Error &&
                        error.message.startsWith("ERROR-CW-01")
                    ) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: error.message,
                                },
                            ],
                        };
                    }
                    throw new McpError(
                        ErrorCode.InternalError,
                        `Failed to analyze image region: ${error instanceof Error ? error.message : "Unknown error"}`
                    );
                }
            }

            if (toolName === "match_dmc_thread") {
                const schema = z.object({
                    hex: z.string().regex(/^#?[0-9a-fA-F]{6}$/),
                });

                const parseResult = schema.safeParse(request.params.arguments);
                if (!parseResult.success) {
                    throw new McpError(
                        ErrorCode.InvalidParams,
                        "Invalid hex color format"
                    );
                }

                const { hex } = parseResult.data;

                // Placeholder for physical material matching logic
                return {
                    content: [
                        {
                            type: "text",
                            text: `Instrument CW-02 (Material Match) invoked for color ${hex}. Logic pending connection to spectral database.`,
                        },
                    ],
                };
            }

            if (toolName === "apply_aesthetic_offset") {
                const colorSchema = z.object({
                    hex: z.string(),
                    rgb: z.object({
                        r: z.number().min(0).max(255),
                        g: z.number().min(0).max(255),
                        b: z.number().min(0).max(255),
                    }),
                });

                const schema = z.object({
                    colors: z.array(colorSchema),
                    profile_name: z.enum(["Lynchian", "Southern Gothic", "Brutalist"]),
                });

                const parseResult = schema.safeParse(request.params.arguments);
                if (!parseResult.success) {
                    throw new McpError(
                        ErrorCode.InvalidParams,
                        "Invalid parameters for apply_aesthetic_offset"
                    );
                }

                const { colors, profile_name } = parseResult.data;

                try {
                    const result = vibeShifter(colors as ColorArray, profile_name);

                    // Format output as side-by-side technical spec
                    const originalSpec = result.original
                        .map(
                            (c, i) =>
                                `  [${i}] HEX: ${c.hex}, RGB: (${c.rgb.r}, ${c.rgb.g}, ${c.rgb.b})`
                        )
                        .join("\n");
                    const artisanSpec = result.artisan
                        .map(
                            (c, i) =>
                                `  [${i}] HEX: ${c.hex}, RGB: (${c.rgb.r}, ${c.rgb.g}, ${c.rgb.b})`
                        )
                        .join("\n");

                    return {
                        content: [
                            {
                                type: "text",
                                text: `Instrument CW-03 (Aesthetic Offset) invoked for ${colors.length} color(s) with profile "${profile_name}".\n\nOriginal Palette:\n${originalSpec}\n\nArtisan Palette:\n${artisanSpec}\n\n${result.note}`,
                            },
                        ],
                    };
                } catch (error) {
                    if (
                        error instanceof Error &&
                        error.message.startsWith("ERROR-CW-03")
                    ) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: error.message,
                                },
                            ],
                        };
                    }
                    throw new McpError(
                        ErrorCode.InternalError,
                        `Failed to apply aesthetic offset: ${error instanceof Error ? error.message : "Unknown error"}`
                    );
                }
            }

            if (toolName === "generate_stitch_pattern") {
                const schema = z.object({
                    image_path: z.string(),
                    hoop_size_inches: z.number().positive(),
                    fabric_count: z.number().positive().optional().default(14),
                    max_colors: z.number().positive().optional().default(50),
                    aesthetic_profile: z.enum(["Lynchian", "Southern Gothic", "Brutalist"]).optional(),
                });

                const parseResult = schema.safeParse(request.params.arguments);
                if (!parseResult.success) {
                    throw new McpError(
                        ErrorCode.InvalidParams,
                        "Invalid parameters for generate_stitch_pattern"
                    );
                }

                const { image_path, hoop_size_inches, fabric_count, max_colors, aesthetic_profile } = parseResult.data;

                try {
                    const result = await generateStitchPattern(
                        image_path,
                        hoop_size_inches,
                        fabric_count,
                        max_colors,
                        aesthetic_profile
                    );

                    const manifestText = result.dmc_manifest
                        .map(
                            (item) =>
                                `  [${item.id}] ${item.name.padEnd(30)} | Symbol: ${item.symbol} | Stitches: ${item.stitch_count}`
                        )
                        .join("\n");

                    const totalStitches = result.dimensions.width * result.dimensions.height;
                    const aestheticNote = aesthetic_profile
                        ? `\n\nCW-03 (Aesthetic Offset) applied: ${aesthetic_profile} profile rectified palette for narrative tension.`
                        : "";

                    return {
                        content: [
                            {
                                type: "text",
                                text: `Instrument CW-04 (Pattern Generation) invoked for image ${image_path}.${aestheticNote}\n\nGrid-Stitch Transformation Matrix initialized.\nDimensions: ${result.dimensions.width} × ${result.dimensions.height} stitches.\nTotal stitch count: ${totalStitches}\n\nDMC Thread Manifest:\n${manifestText}\n\nPDF specification sheet generated: ${result.pdf_path}`,
                            },
                        ],
                    };
                } catch (error) {
                    if (
                        error instanceof Error &&
                        error.message.startsWith("ERROR-CW-04")
                    ) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: error.message,
                                },
                            ],
                        };
                    }
                    throw new McpError(
                        ErrorCode.InternalError,
                        `Failed to generate stitch pattern: ${error instanceof Error ? error.message : "Unknown error"}`
                    );
                }
            }

            if (toolName === "generate_blueprint") {
                const schema = z.object({
                    image_path: z.string(),
                    num_colors: z.number().optional().default(12),
                    min_area: z.number().optional().default(100),
                    epsilon: z.number().optional().default(1.0),
                    max_dim: z.number().optional().default(1024),
                });

                const parseResult = schema.safeParse(request.params.arguments);
                if (!parseResult.success) {
                    throw new McpError(
                        ErrorCode.InvalidParams,
                        "Invalid parameters for generate_blueprint"
                    );
                }

                const { image_path, num_colors, min_area, epsilon, max_dim } = parseResult.data;

                try {
                    const result = await generateBlueprint({
                        imagePath: image_path,
                        numColors: num_colors,
                        minArea: min_area,
                        epsilon,
                        maxDim: max_dim,
                    });

                    return {
                        content: [
                            {
                                type: "text",
                                text: `Instrument CW-05 (Blueprint Mode) invoked for image ${image_path}.\n\nTransformation complete.\nRegions identified: ${result.regionCount}\nColor clusters: ${result.clusters.length}\n\nSVG generated (see below).`,
                            },
                            {
                                type: "text",
                                text: result.svg,
                            }
                        ],
                    };
                } catch (error) {
                    throw new McpError(
                        ErrorCode.InternalError,
                        `Failed to generate blueprint: ${error instanceof Error ? error.message : "Unknown error"}`
                    );
                }
            }

            throw new McpError(
                ErrorCode.MethodNotFound,
                `Unknown tool: ${toolName}`
            );
        });
    }

    async run(transport?: any) {
        const serverTransport = transport || new StdioServerTransport();
        await this.server.connect(serverTransport);
        // Only log when using stdio transport and not in test environment
        if (!transport && process.env.NODE_ENV !== 'test' && typeof process.env.VITEST === 'undefined') {
            console.error("ColorWizard MCP server running on stdio");
        }
    }

    getServer(): Server {
        return this.server;
    }
}

const server = new ColorWizardServer();
server.run().catch(console.error);
