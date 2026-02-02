/**
 * Simple HTTP server wrapper for ColorWizard demo
 * Exposes generate_blueprint_v1 handler via HTTP endpoint
 */

import http from "http";
import { URL } from "url";
import { join } from "path";
import { generateBlueprintV1Handler, type GenerateBlueprintV1Input } from "../src/tools/generate_blueprint_v1.js";
import { imageRegisterHandler, type ImageRegisterInput } from "../src/tools/sample_color.js";
import { matchDmcHandler, type MatchDmcInput } from "../src/tools/match_dmc.js";

const PORT = process.env.DEMO_PORT ? parseInt(process.env.DEMO_PORT) : 3001;

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
    }

    // Parse URL pathname (req.url includes pathname + query string)
    const rawUrl = req.url || "/";
    const urlPath = rawUrl.split('?')[0];

    // Health check endpoint
    if (urlPath === "/health" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, message: "Demo server running" }));
        return;
    }

    // Image register endpoint
    if (urlPath === "/api/image-register" && req.method === "POST") {
        let body = "";
        
        req.on("data", (chunk) => {
            body += chunk.toString();
        });

        req.on("end", async () => {
            try {
                const input: ImageRegisterInput = JSON.parse(body);
                
                // Validate required fields
                if (!input.imageBase64) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ ok: false, error: "imageBase64 is required" }));
                    return;
                }

                // Set defaults
                const requestInput: ImageRegisterInput = {
                    ...input,
                    maxSize: input.maxSize || 2048,
                };

                const result = await imageRegisterHandler(requestInput);

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            } catch (error) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(
                    JSON.stringify({
                        ok: false,
                        error: error instanceof Error ? error.message : "Unknown error",
                    })
                );
            }
        });
        return;
    }

    // Batch DMC matching endpoint (for progressive loading)
    if (urlPath === "/api/match-dmc-batch" && req.method === "POST") {
        let body = "";
        
        req.on("data", (chunk) => {
            body += chunk.toString();
        });

        req.on("end", async () => {
            try {
                const input: { colors: Array<{ r: number; g: number; b: number }> } = JSON.parse(body);
                
                // Validate input
                if (!Array.isArray(input.colors)) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ ok: false, error: "colors must be an array" }));
                    return;
                }

                // Match each color
                const results = input.colors.map((rgb) => {
                    const matchInput: MatchDmcInput = { rgb };
                    return matchDmcHandler(matchInput);
                });

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: true, matches: results }));
            } catch (error) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(
                    JSON.stringify({
                        ok: false,
                        error: error instanceof Error ? error.message : "Unknown error",
                    })
                );
            }
        });
        return;
    }

    // Generate blueprint endpoint
    if (urlPath === "/api/generate-blueprint-v1" && req.method === "POST") {
        let body = "";
        
        req.on("data", (chunk) => {
            body += chunk.toString();
        });

        req.on("end", async () => {
            try {
                const input: GenerateBlueprintV1Input = JSON.parse(body);
                
                // Validate required fields
                if (!input.paletteSize || input.paletteSize < 1) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ ok: false, error: "paletteSize must be a positive integer" }));
                    return;
                }

                if (!input.imageId && !input.imageBase64) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ ok: false, error: "Either imageId or imageBase64 is required" }));
                    return;
                }

                // Set defaults
                const requestInput: GenerateBlueprintV1Input = {
                    ...input,
                    maxSize: input.maxSize || 2048,
                    seed: input.seed || 42,
                    returnPreview: input.returnPreview !== undefined ? input.returnPreview : true,
                    minRegionArea: input.minRegionArea || 0,
                    mergeSmallRegions: input.mergeSmallRegions !== undefined ? input.mergeSmallRegions : (input.minRegionArea ? true : false),
                    includeDmc: input.includeDmc !== undefined ? input.includeDmc : true, // Default to true for backward compatibility
                };

                const result = await generateBlueprintV1Handler(requestInput);

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            } catch (error) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(
                    JSON.stringify({
                        ok: false,
                        error: error instanceof Error ? error.message : "Unknown error",
                    })
                );
            }
        });
        return;
    }

    // Serve static files
    if (urlPath === "/" || urlPath === "/index.html") {
        (async () => {
            try {
                const fs = await import("fs/promises");
                // Resolve path relative to this file's location
                const htmlPath = join(process.cwd(), "demo", "index.html");
                const html = await fs.readFile(htmlPath, "utf-8");
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(html);
            } catch (error) {
                res.writeHead(404);
                res.end(`Demo HTML not found: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
        })();
        return;
    }

    // 404 for other routes
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Not found" }));
});

server.listen(PORT, () => {
    console.log(`ColorWizard Demo Server running on http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});

// Graceful shutdown
process.on("SIGINT", () => {
    console.log("\nShutting down demo server...");
    server.close(() => {
        console.log("Demo server closed");
        process.exit(0);
    });
});
