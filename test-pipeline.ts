/**
 * Artisan Studio Test Prompt
 * Full "Spectral-to-Stitch" Pipeline Test
 * 
 * Role: ColorWizard Curator (Root Orchestrator)
 * Aesthetic Profile: Southern Gothic / Editorial Modernism
 * User Persona: Fiber Artist (Magpie Embroidery)
 */

import { generateStitchPattern } from "./src/tools/pattern.js";
import { analyzeImageRegion } from "./src/tools/vision.js";
import { vibeShifter, type Color } from "./src/tools/vibe.js";
import { ColorMatcher } from "./src/engine/spectral.js";
import sharp from "sharp";
import { existsSync } from "fs";
import { resolve } from "path";

/**
 * Creates a simple test image (sunflower-like pattern) if no image is provided
 */
async function createTestImage(imagePath: string): Promise<void> {
    if (existsSync(imagePath)) {
        console.log(`Using existing image: ${imagePath}`);
        return;
    }

    console.log(`Creating test image: ${imagePath}`);
    
    // Create a simple sunflower-like image: yellow center, green background, warm tones
    const width = 400;
    const height = 400;
    const centerX = width / 2;
    const centerY = height / 2;
    
    const image = sharp({
        create: {
            width,
            height,
            channels: 3,
            background: { r: 34, g: 139, b: 34 } // Forest green background
        }
    });
    
    const pixels = Buffer.alloc(width * height * 3);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dx = x - centerX;
            const dy = y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            
            const index = (y * width + x) * 3;
            
            // Sunflower center (warm yellow/brown)
            if (distance < 80) {
                const radius = distance / 80;
                pixels[index] = Math.floor(200 + 55 * radius);     // R: warm yellow to brown
                pixels[index + 1] = Math.floor(180 + 30 * radius);  // G
                pixels[index + 2] = Math.floor(50 + 20 * radius);    // B
            }
            // Petals (yellow)
            else if (distance < 150 && Math.abs(Math.sin(angle * 8)) > 0.7) {
                pixels[index] = 255;     // R: bright yellow
                pixels[index + 1] = 220; // G
                pixels[index + 2] = 50;  // B
            }
            // Background (warm green)
            else {
                pixels[index] = 34;      // R: forest green
                pixels[index + 1] = 139; // G
                pixels[index + 2] = 34;  // B
            }
        }
    }
    
    await sharp(pixels, {
        raw: {
            width,
            height,
            channels: 3
        }
    })
    .jpeg()
    .toFile(imagePath);
    
    console.log(`Test image created: ${imagePath}`);
}

/**
 * Main pipeline execution
 */
async function executePipeline() {
    console.log("=".repeat(80));
    console.log("COLORWIZARD SPECTRAL-TO-STITCH PIPELINE TEST");
    console.log("Aesthetic Profile: Southern Gothic / Editorial Modernism");
    console.log("=".repeat(80));
    console.log();

    // Project parameters
    const imagePath = process.argv[2] || "./test-sunflower.jpg";
    const hoopSizeInches = 5;
    const fabricCount = 14;
    const aestheticProfile: "Southern Gothic" = "Southern Gothic";

    // Step 1: Create test image if needed
    const resolvedImagePath = resolve(imagePath);
    await createTestImage(resolvedImagePath);

    console.log("STEP 1: CW-01 (Spectral Analysis) - Image Perception");
    console.log("-".repeat(80));
    
    // Analyze a few key regions
    const metadata = await sharp(resolvedImagePath).metadata();
    const centerX = (metadata.width || 400) / 2;
    const centerY = (metadata.height || 400) / 2;
    
    const centerRegion = await analyzeImageRegion(resolvedImagePath, centerX, centerY, 10);
    console.log(`Center region: HEX: ${centerRegion.hex}, RGB: (${centerRegion.rgb.r}, ${centerRegion.rgb.g}, ${centerRegion.rgb.b})`);
    
    const topLeftRegion = await analyzeImageRegion(resolvedImagePath, centerX * 0.3, centerY * 0.3, 10);
    console.log(`Top-left region: HEX: ${topLeftRegion.hex}, RGB: (${topLeftRegion.rgb.r}, ${topLeftRegion.rgb.g}, ${topLeftRegion.rgb.b})`);
    
    const bottomRightRegion = await analyzeImageRegion(resolvedImagePath, centerX * 1.7, centerY * 1.7, 10);
    console.log(`Bottom-right region: HEX: ${bottomRightRegion.hex}, RGB: (${bottomRightRegion.rgb.r}, ${bottomRightRegion.rgb.g}, ${bottomRightRegion.rgb.b})`);
    console.log();

    console.log("STEP 2: CW-03 (Aesthetic Offset) - Vibe Shift");
    console.log("-".repeat(80));
    
    // Demonstrate vibe shift on sample colors
    const sampleColors: Color[] = [
        centerRegion,
        topLeftRegion,
        bottomRightRegion
    ];
    
    const vibeResult = vibeShifter(sampleColors, aestheticProfile);
    console.log(`Profile: ${aestheticProfile}`);
    console.log("Original → Artisan transformation:");
    vibeResult.original.forEach((orig, i) => {
        const artisan = vibeResult.artisan[i];
        console.log(`  [${i}] ${orig.hex} → ${artisan.hex}`);
        console.log(`      RGB: (${orig.rgb.r}, ${orig.rgb.g}, ${orig.rgb.b}) → (${artisan.rgb.r}, ${artisan.rgb.g}, ${artisan.rgb.b})`);
    });
    console.log(`Note: ${vibeResult.note}`);
    console.log();

    console.log("STEP 3: CW-04 (Pattern Generation) - Grid-Stitch Transformation Matrix");
    console.log("-".repeat(80));
    console.log(`Processing image: ${resolvedImagePath}`);
    console.log(`Hoop size: ${hoopSizeInches} inches`);
    console.log(`Fabric count: ${fabricCount} stitches/inch`);
    console.log(`Aesthetic profile: ${aestheticProfile}`);
    console.log();

    // Execute full pattern generation with Southern Gothic vibe shift
    const result = await generateStitchPattern(
        resolvedImagePath,
        hoopSizeInches,
        fabricCount,
        50, // max_colors
        aestheticProfile
    );

    console.log("=".repeat(80));
    console.log("PATTERN GENERATION COMPLETE");
    console.log("=".repeat(80));
    console.log();
    
    console.log("Grid-Stitch Transformation Matrix:");
    console.log(`Dimensions: ${result.dimensions.width} × ${result.dimensions.height} stitches`);
    const totalStitches = result.dimensions.width * result.dimensions.height;
    console.log(`Total stitch count: ${totalStitches}`);
    console.log();

    console.log("DMC Thread Manifest:");
    console.log("-".repeat(80));
    console.log("ID    | Name                            | Symbol | Stitches");
    console.log("-".repeat(80));
    
    result.dmc_manifest.forEach(item => {
        console.log(`${item.id.padEnd(5)} | ${item.name.padEnd(30)} | ${item.symbol.padEnd(6)} | ${item.stitch_count.toString().padStart(7)}`);
    });
    console.log();

    console.log("=".repeat(80));
    console.log("EDITORIAL MODERNIST SUMMARY");
    console.log("=".repeat(80));
    console.log();
    
    const threadCount = result.dmc_manifest.length;
    const topThreads = result.dmc_manifest.slice(0, 10);
    
    console.log(`Thread Selection: ${threadCount} DMC threads selected from spectral analysis.`);
    console.log(`Primary threads (top 10 by usage):`);
    topThreads.forEach((thread, i) => {
        const percentage = ((thread.stitch_count / totalStitches) * 100).toFixed(1);
        console.log(`  ${i + 1}. DMC ${thread.id} (${thread.name}) - ${thread.stitch_count} stitches (${percentage}%)`);
    });
    console.log();
    console.log(`Total Stitch Count: ${totalStitches} stitches`);
    console.log(`Pattern Dimensions: ${result.dimensions.width} × ${result.dimensions.height} stitches`);
    console.log(`Fabric Coverage: ${hoopSizeInches}" circular hoop, ${fabricCount}-count Aida`);
    console.log();
    console.log(`PDF Specification Sheet: ${result.pdf_path}`);
    console.log();
    console.log("Pipeline execution complete.");
}

// Execute pipeline
executePipeline().catch(error => {
    console.error("Pipeline execution failed:", error);
    process.exit(1);
});
