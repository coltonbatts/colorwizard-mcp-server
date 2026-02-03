import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { tools, toolHandlers } from "./tools/index.js";
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
            tools,
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const toolName = request.params.name;

            // Ping tool handler
            if (toolName === "ping") {
                const schema = z.object({
                    message: z.string().optional(),
                });

                const parseResult = schema.safeParse(request.params.arguments);
                if (!parseResult.success) {
                    throw new McpError(
                        ErrorCode.InvalidParams,
                        "Invalid parameters for ping"
                    );
                }

                const result = toolHandlers.ping(parseResult.data);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }

            // Health tool handler
            if (toolName === "health") {
                const result = toolHandlers.health({});
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }

            // Match DMC tool handler
            if (toolName === "match_dmc") {
                const schema = z.object({
                    rgb: z.object({
                        r: z.number().min(0).max(255),
                        g: z.number().min(0).max(255),
                        b: z.number().min(0).max(255),
                    }).optional(),
                    hex: z.string().regex(/^#?[0-9a-fA-F]{6}$/).optional(),
                }).refine((data) => data.rgb || data.hex, {
                    message: "Either 'rgb' or 'hex' must be provided",
                });

                const parseResult = schema.safeParse(request.params.arguments);
                if (!parseResult.success) {
                    throw new McpError(
                        ErrorCode.InvalidParams,
                        parseResult.error.issues[0]?.message || "Invalid parameters for match_dmc"
                    );
                }

                const result = toolHandlers.match_dmc(parseResult.data);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }

            // Image register tool handler
            if (toolName === "image_register") {
                const schema = z.object({
                    imageBase64: z.string(),
                    maxSize: z.number().positive().optional(),
                });

                const parseResult = schema.safeParse(request.params.arguments);
                if (!parseResult.success) {
                    throw new McpError(
                        ErrorCode.InvalidParams,
                        parseResult.error.issues[0]?.message || "Invalid parameters for image_register"
                    );
                }

                const result = await toolHandlers.image_register(parseResult.data);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }

            // Sample color tool handler
            if (toolName === "sample_color") {
                const schema = z.object({
                    imageId: z.string().optional(),
                    imageBase64: z.string().optional(),
                    x: z.number().min(0).max(1),
                    y: z.number().min(0).max(1),
                    radius: z.number().min(0).optional(),
                    maxSize: z.number().positive().optional(),
                }).refine((data) => data.imageId || data.imageBase64, {
                    message: "Either 'imageId' or 'imageBase64' must be provided",
                });

                const parseResult = schema.safeParse(request.params.arguments);
                if (!parseResult.success) {
                    throw new McpError(
                        ErrorCode.InvalidParams,
                        parseResult.error.issues[0]?.message || "Invalid parameters for sample_color"
                    );
                }

                const result = await toolHandlers.sample_color(parseResult.data);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }

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

            if (toolName === "generate_blueprint_v1") {
                const schema = z.object({
                    imageId: z.string().optional(),
                    imageBase64: z.string().optional(),
                    paletteSize: z.number().int().positive(),
                    maxSize: z.number().positive().optional(),
                }).refine((data) => data.imageId || data.imageBase64, {
                    message: "Either 'imageId' or 'imageBase64' must be provided",
                });

                const parseResult = schema.safeParse(request.params.arguments);
                if (!parseResult.success) {
                    throw new McpError(
                        ErrorCode.InvalidParams,
                        parseResult.error.issues[0]?.message || "Invalid parameters for generate_blueprint_v1"
                    );
                }

                const result = await toolHandlers.generate_blueprint_v1(parseResult.data);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }

            if (toolName === "generate_blueprint_v2") {
                const schema = z.object({
                    imageId: z.string().optional(),
                    imageBase64: z.string().optional(),
                    paletteSize: z.number().int().positive(),
                    maxSize: z.number().positive().optional(),
                    seed: z.number().optional(),
                    returnPreview: z.boolean().optional(),
                    minRegionArea: z.number().min(0).optional(),
                    mergeSmallRegions: z.boolean().optional(),
                }).refine((data) => data.imageId || data.imageBase64, {
                    message: "Either 'imageId' or 'imageBase64' must be provided",
                });

                const parseResult = schema.safeParse(request.params.arguments);
                if (!parseResult.success) {
                    throw new McpError(
                        ErrorCode.InvalidParams,
                        parseResult.error.issues[0]?.message || "Invalid parameters for generate_blueprint_v2"
                    );
                }

                const result = await toolHandlers.generate_blueprint_v2(parseResult.data);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
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
