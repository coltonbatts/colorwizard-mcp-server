/**
 * Blueprint Mode Test Script
 */

import { generateBlueprint } from "./src/lib/blueprint/generateBlueprint.js";
import { writeFileSync, existsSync } from "fs";
import { resolve } from "path";

async function runTest() {
    const imagePath = process.argv[2] || "./test-sunflower.jpg";
    const resolvedPath = resolve(imagePath);

    if (!existsSync(resolvedPath)) {
        console.error(`Error: Image not found at ${resolvedPath}`);
        process.exit(1);
    }

    console.log(`Generating blueprint for: ${resolvedPath}...`);

    try {
        const result = await generateBlueprint({
            imagePath: resolvedPath,
            numColors: 12,
            minArea: 100,
            epsilon: 1.0,
            maxDim: 1024
        });

        const outputPath = "./colorwizard-blueprint.svg";
        writeFileSync(outputPath, result.svg);

        console.log("=".repeat(80));
        console.log("BLUEPRINT GENERATION COMPLETE");
        console.log("=".repeat(80));
        console.log(`Regions identified: ${result.regionCount}`);
        console.log(`Color clusters: ${result.clusters.length}`);
        console.log(`SVG saved to: ${outputPath}`);
        console.log("=".repeat(80));

    } catch (error) {
        console.error("Blueprint generation failed:", error);
        process.exit(1);
    }
}

runTest();
