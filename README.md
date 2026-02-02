# ColorWizard MCP Server

A Model Context Protocol (MCP) server for color matching, thread identification, and pattern generation for embroidery and cross-stitch projects.

## Quickstart

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
# Run server in development mode (with hot reload)
npm run dev

# Build TypeScript to JavaScript
npm run build

# Run built server
npm start

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Available Tools

### `ping`

Health check tool that echoes a message with timestamp.

**Input:**
```json
{
  "message": "optional message to echo"
}
```

**Output:**
```json
{
  "ok": true,
  "echo": "pong",
  "timestamp": "2026-02-02T12:00:00.000Z"
}
```

### `health`

Returns server health status including version, uptime, tool count, dataset availability, and cache statistics.

**Input:**
```json
{}
```

**Output:**
```json
{
  "ok": true,
  "version": "1.0.0",
  "uptimeSec": 1234,
  "toolCount": 7,
  "datasets": {
    "dmc": true
  },
  "cache": {
    "images": 2,
    "hits": 15,
    "misses": 5
  }
}
```

**Fields:**
- `version`: Server version from package.json or VERSION environment variable
- `uptimeSec`: Server uptime in seconds since process start
- `toolCount`: Number of available MCP tools
- `datasets.dmc`: Boolean indicating if DMC dataset is loaded
- `cache.images`: Number of cached decoded/resized images
- `cache.hits`: Number of cache hits
- `cache.misses`: Number of cache misses

### `match_dmc`

Matches a color (RGB or hex) to the nearest DMC embroidery thread using Lab color space and Delta E (CIE76) calculation for perceptually accurate color matching.

**Input Formats:**

You can provide either RGB or hex (but not both):

```json
{
  "rgb": { "r": 255, "g": 0, "b": 0 }
}
```

or

```json
{
  "hex": "#FF0000"
}
```

Hex values can be provided with or without the `#` prefix (e.g., `"#FF0000"` or `"FF0000"`).

RGB values should be integers in the range 0-255. Values outside this range will be clamped.

**Output:**

On success (`ok: true`):
```json
{
  "ok": true,
  "best": {
    "id": "DMC-666",
    "name": "Bright Christmas Red",
    "hex": "#E31D42",
    "deltaE": 0.0
  },
  "alternatives": [
    {
      "id": "DMC-321",
      "name": "Christmas Red",
      "hex": "#C72B3B",
      "deltaE": 8.45
    },
    {
      "id": "DMC-498",
      "name": "Christmas Red Dark",
      "hex": "#A91D2D",
      "deltaE": 12.67
    },
    {
      "id": "DMC-347",
      "name": "Salmon Very Dark",
      "hex": "#BF1F2C",
      "deltaE": 15.23
    },
    {
      "id": "DMC-349",
      "name": "Coral Red Very Dark",
      "hex": "#C91F2C",
      "deltaE": 16.89
    },
    {
      "id": "DMC-350",
      "name": "Coral Red Dark",
      "hex": "#E31D2C",
      "deltaE": 18.12
    }
  ]
}
```

On error (`ok: false`):
```json
{
  "ok": false,
  "error": "Either 'rgb' or 'hex' must be provided"
}
```

**Delta E Values:**
- `deltaE` represents the perceptual color difference using CIE76 Delta E calculation
- Lower values indicate closer color matches
- Values < 1.0: imperceptible difference
- Values 1.0-2.0: very slight difference
- Values 2.0-10.0: noticeable difference
- Values > 10.0: significant difference

**Notes:**
- The tool uses Lab color space conversion for perceptually accurate matching
- RGB values are normalized to sRGB color space
- The dataset contains 500+ DMC thread colors
- If the DMC dataset (`src/data/dmc.json`) is not available, the tool will return `ok: false` with an error message

### `image_register`

Registers a base64-encoded image and returns an `imageId` for efficient session-based color sampling. Use this for real-time thumb-drag scenarios where you'll sample multiple times from the same image without sending the base64 data each time.

**Input:**
```json
{
  "imageBase64": "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFElEQVR4nGP4z8CABzGMSjNgCRYAt8pjnQuW8k0AAAAASUVORK5CYII=",
  "maxSize": 2048
}
```

**Output:**

On success (`ok: true`):
```json
{
  "ok": true,
  "imageId": "a1b2c3d4e5f6...",
  "width": 10,
  "height": 10
}
```

On error (`ok: false`):
```json
{
  "ok": false,
  "error": "Invalid base64 image data"
}
```

**Fields:**
- `imageId`: SHA-256 hash-based identifier for the registered image (stable across calls with same image and maxSize)
- `width`: Image width in pixels after optional resizing
- `height`: Image height in pixels after optional resizing
- `maxSize`: Maximum dimension for image resize (default: 2048). Images larger than this will be resized while preserving aspect ratio.

**Notes:**
- The `imageId` is a stable hash based on the image data and `maxSize` parameter
- Registered images are cached in memory for fast subsequent sampling
- Use this tool before calling `sample_color` multiple times with the same image for optimal performance

### `sample_color`

Samples a pixel or small region from an image and returns RGB/hex/Lab color data plus nearest DMC thread match. Supports two usage patterns:

1. **One-shot mode**: Provide `imageBase64` directly (backward compatible)
2. **Session mode**: Use `imageId` from `image_register` for efficient repeated sampling

**Input Formats:**

**Session mode** (recommended for multiple samples):
```json
{
  "imageId": "a1b2c3d4e5f6...",
  "x": 0.5,
  "y": 0.5,
  "radius": 0
}
```

**One-shot mode** (backward compatible):
```json
{
  "imageBase64": "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFElEQVR4nGP4z8CABzGMSjNgCRYAt8pjnQuW8k0AAAAASUVORK5CYII=",
  "x": 0.5,
  "y": 0.5,
  "radius": 0,
  "maxSize": 2048
}
```

**Parameters:**
- `imageId` (optional): Image ID from `image_register` - use for session-based sampling
- `imageBase64` (optional): Base64-encoded image data - use for one-shot sampling
- `x`: Normalized X coordinate (0.0 to 1.0, where 0.0 is left edge, 1.0 is right edge)
- `y`: Normalized Y coordinate (0.0 to 1.0, where 0.0 is top edge, 1.0 is bottom edge)
- `radius`: Sampling radius in pixels (default: 0 for single pixel). When > 0, averages colors in a square region
- `maxSize`: Maximum dimension for image resize (default: 2048, only used when `imageBase64` is provided)

**Output:**

On success (`ok: true`):
```json
{
  "ok": true,
  "rgb": { "r": 255, "g": 0, "b": 0 },
  "hex": "#FF0000",
  "lab": { "l": 53.24, "a": 80.09, "b": 67.20 },
  "match": {
    "ok": true,
    "best": {
      "id": "DMC-666",
      "name": "Bright Christmas Red",
      "hex": "#E31D42",
      "deltaE": 8.45
    },
    "alternatives": [
      {
        "id": "DMC-321",
        "name": "Christmas Red",
        "hex": "#C72B3B",
        "deltaE": 12.67
      }
    ],
    "method": "lab-d65-deltae76"
  },
  "method": "lab-d65-deltae76",
  "inputNormalized": {
    "rgb": { "r": 255, "g": 0, "b": 0 },
    "hex": "#FF0000"
  }
}
```

On error (`ok: false`):
```json
{
  "ok": false,
  "error": "Image with ID 'abc123' not found in cache. Register the image first using image_register."
}
```

**Usage Patterns:**

**One-shot mode** (for single samples):
```json
{
  "imageBase64": "<base64 data>",
  "x": 0.5,
  "y": 0.5
}
```

**Session mode** (for real-time thumb-drag):
1. Register image once:
```json
{
  "imageBase64": "<base64 data>"
}
```
→ Returns `{ "ok": true, "imageId": "abc123...", "width": 800, "height": 600 }`

2. Sample multiple times using `imageId`:
```json
{ "imageId": "abc123...", "x": 0.1, "y": 0.2 }
{ "imageId": "abc123...", "x": 0.3, "y": 0.4 }
{ "imageId": "abc123...", "x": 0.5, "y": 0.6 }
```

**Notes:**
- Session mode avoids sending base64 data on every call, making it ideal for real-time interactions
- Images are cached in memory (LRU eviction, max 5 images)
- Coordinates are normalized (0.0-1.0), making them resolution-independent
- When `radius > 0`, colors are averaged across a square region centered at (x, y)
- The tool automatically handles data URL format (`data:image/png;base64,...`)

### `analyze_image_region`

Extracts precise pixel data from a local image file at specified coordinates.

**Input:**
```json
{
  "image_path": "/path/to/image.jpg",
  "x": 100,
  "y": 200,
  "radius": 5
}
```

### `apply_aesthetic_offset`

Modifies an input color array to match specific aesthetic profiles (Lynchian, Southern Gothic, Brutalist).

**Input:**
```json
{
  "colors": [
    { "hex": "#FF0000", "rgb": { "r": 255, "g": 0, "b": 0 } }
  ],
  "profile_name": "Lynchian"
}
```

### `generate_stitch_pattern`

Transforms a raw image into a symbol-coded cross-stitch grid with matching DMC manifest.

**Input:**
```json
{
  "image_path": "/path/to/image.jpg",
  "hoop_size_inches": 8,
  "fabric_count": 14,
  "max_colors": 50,
  "aesthetic_profile": "Lynchian"
}
```

### `generate_blueprint`

Transforms an input image into a vector paint-by-number SVG blueprint.

**Input:**
```json
{
  "image_path": "/path/to/image.jpg",
  "num_colors": 12,
  "min_area": 100,
  "epsilon": 1.0,
  "max_dim": 1024
}
```

### `generate_blueprint_v1`

Quantizes an image into N perceptual colors using Lab color space, returns a palette with per-color pixel counts and DMC thread matches. Phase 1: no SVG tracing, no region adjacency, no contours.

### `generate_blueprint_v2`

Quantizes an image into N perceptual colors using Lab color space, extracts region contours (polylines), returns palette + per-region contours. Phase 2: contour extraction (no SVG).

**Input Formats:**

**Session mode** (recommended for multiple operations):
```json
{
  "imageId": "a1b2c3d4e5f6...",
  "paletteSize": 12
}
```

**One-shot mode**:
```json
{
  "imageBase64": "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFElEQVR4nGP4z8CABzGMSjNgCRYAt8pjnQuW8k0AAAAASUVORK5CYII=",
  "paletteSize": 12,
  "maxSize": 2048
}
```

**Parameters:**
- `imageId` (optional): Image ID from `image_register` - use for session-based processing
- `imageBase64` (optional): Base64-encoded image data - use for one-shot processing
- `paletteSize` (required): Number of colors to quantize to (positive integer)
- `maxSize` (optional): Maximum dimension for image resize (default: 2048, only used when `imageBase64` is provided)
- `seed` (optional): Seed for deterministic output (default: 42). Same input + same seed produces identical results
- `returnPreview` (optional): If `true`, returns `indexedPreviewPngBase64` with quantized preview image (default: `false`)
- `minRegionArea` (optional): Minimum region area in pixels for region cleanup (default: 0, meaning off). When > 0, merges small regions to reduce confetti artifacts. Recommended: 50-200 depending on `maxSize`.
- `mergeSmallRegions` (optional): If `true`, merge regions smaller than `minRegionArea` (default: `true` when `minRegionArea > 0`, `false` otherwise)

**Output:**

On success (`ok: true`):
```json
{
  "ok": true,
  "palette": [
    {
      "rgb": { "r": 255, "g": 0, "b": 0 },
      "hex": "#FF0000",
      "lab": { "l": 53.24, "a": 80.09, "b": 67.20 },
      "count": 5000,
      "percent": 50.0,
      "dmcMatch": {
        "ok": true,
        "best": {
          "id": "DMC-666",
          "name": "Bright Christmas Red",
          "hex": "#E31D42",
          "deltaE": 8.45
        },
        "alternatives": [
          {
            "id": "DMC-321",
            "name": "Christmas Red",
            "hex": "#C72B3B",
            "deltaE": 12.67
          }
        ],
        "method": "lab-d65-deltae76"
      }
    }
  ],
  "totalPixels": 10000,
  "method": "lab-kmeans-deltae76",
  "indexedPreviewPngBase64": "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFElEQVR4nGP4z8CABzGMSjNgCRYAt8pjnQuW8k0AAAAASUVORK5CYII="
}
```

**Note:** `indexedPreviewPngBase64` is only included when `returnPreview: true`. It contains a base64-encoded PNG image where each pixel is replaced by its cluster mean color, at the resized working dimensions (`maxSize`).

On error (`ok: false`):
```json
{
  "ok": false,
  "error": "Either 'imageId' or 'imageBase64' must be provided"
}
```

**Fields:**
- `palette`: Array of palette colors sorted by pixel count (descending)
  - `rgb`: RGB color values (0-255)
  - `hex`: Hex color code
  - `lab`: Lab color space coordinates
  - `count`: Number of pixels assigned to this color
  - `percent`: Percentage of total pixels (0-100)
  - `dmcMatch`: DMC thread match for this palette color
- `totalPixels`: Total number of pixels in the processed image
- `method`: Quantization method used (`lab-kmeans-deltae76`)
- `indexedPreviewPngBase64` (optional): Base64-encoded PNG preview image showing quantized result. Only present when `returnPreview: true`.

**Notes:**
- Uses k-means clustering in Lab color space for perceptually uniform quantization
- Palette colors are sorted by pixel count (most common first)
- Each palette color includes a DMC thread match using the same matching algorithm as `match_dmc`
- Supports both session mode (using `imageId`) and one-shot mode (using `imageBase64`)
- Images are automatically resized to `maxSize` for memory efficiency
- **Deterministic output**: Same input + same `seed` produces identical results. Default seed is `42`.
- **Preview image**: When `returnPreview: true`, returns a quantized preview where each pixel is replaced by its cluster mean color, at the resized working dimensions.
- **Region cleanup (Phase 1.5)**: When `minRegionArea > 0`, performs connected-components analysis (4-connected) and merges small regions into neighboring regions using majority adjacency. This reduces confetti artifacts from quantization. Recommended `minRegionArea` values:
  - Small images (`maxSize` < 512): 10-50 pixels
  - Medium images (`maxSize` 512-1024): 50-100 pixels
  - Large images (`maxSize` > 1024): 100-200 pixels
- Phase 1.5 implementation: includes region cleanup, but no SVG tracing, no region adjacency graphs, no contours

**Input Formats:**

**Session mode** (recommended for multiple operations):
```json
{
  "imageId": "a1b2c3d4e5f6...",
  "paletteSize": 12
}
```

**One-shot mode**:
```json
{
  "imageBase64": "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFElEQVR4nGP4z8CABzGMSjNgCRYAt8pjnQuW8k0AAAAASUVORK5CYII=",
  "paletteSize": 12,
  "maxSize": 2048
}
```

**Parameters:**
- `imageId` (optional): Image ID from `image_register` - use for session-based processing
- `imageBase64` (optional): Base64-encoded image data - use for one-shot processing
- `paletteSize` (required): Number of colors to quantize to (positive integer)
- `maxSize` (optional): Maximum dimension for image resize (default: 2048, only used when `imageBase64` is provided)
- `seed` (optional): Seed for deterministic output (default: 42). Same input + same seed produces identical results
- `returnPreview` (optional): If `true`, returns `indexedPreviewPngBase64` with quantized preview image (default: `false`)
- `minRegionArea` (optional): Minimum region area in pixels for region cleanup (default: 0, meaning off). When > 0, merges small regions to reduce confetti artifacts. Recommended: 50-200 depending on `maxSize`.
- `mergeSmallRegions` (optional): If `true`, merge regions smaller than `minRegionArea` (default: `true` when `minRegionArea > 0`, `false` otherwise)

**Output:**

On success (`ok: true`):
```json
{
  "ok": true,
  "width": 800,
  "height": 600,
  "palette": [
    {
      "rgb": { "r": 255, "g": 0, "b": 0 },
      "hex": "#FF0000",
      "lab": { "l": 53.24, "a": 80.09, "b": 67.20 },
      "count": 5000,
      "percent": 50.0,
      "dmcMatch": {
        "ok": true,
        "best": {
          "id": "DMC-666",
          "name": "Bright Christmas Red",
          "hex": "#E31D42",
          "deltaE": 8.45
        },
        "alternatives": [...],
        "method": "lab-d65-deltae76"
      }
    }
  ],
  "regions": [
    {
      "labelIndex": 0,
      "areaPx": 5000,
      "bbox": {
        "x0": 0,
        "y0": 0,
        "x1": 400,
        "y1": 300
      },
      "contours": [
        [
          { "x": 0, "y": 0 },
          { "x": 400, "y": 0 },
          { "x": 400, "y": 300 },
          { "x": 0, "y": 300 },
          { "x": 0, "y": 0 }
        ]
      ]
    }
  ],
  "totalPixels": 10000,
  "method": "lab-kmeans-deltae76-contours",
  "indexedPreviewPngBase64": "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFElEQVR4nGP4z8CABzGMSjNgCRYAt8pjnQuW8k0AAAAASUVORK5CYII="
}
```

**Note:** `indexedPreviewPngBase64` is only included when `returnPreview: true`. It contains a base64-encoded PNG image where each pixel is replaced by its cluster mean color, at the resized working dimensions (`maxSize`).

On error (`ok: false`):
```json
{
  "ok": false,
  "error": "Either 'imageId' or 'imageBase64' must be provided"
}
```

**Fields:**
- `width`: Image width in pixels after optional resizing
- `height`: Image height in pixels after optional resizing
- `palette`: Array of palette colors sorted by pixel count (descending)
  - `rgb`: RGB color values (0-255)
  - `hex`: Hex color code
  - `lab`: Lab color space coordinates
  - `count`: Number of pixels assigned to this color
  - `percent`: Percentage of total pixels (0-100)
  - `dmcMatch`: DMC thread match for this palette color
- `regions`: Array of regions, each containing:
  - `labelIndex`: Cluster index (palette color index) for this region
  - `areaPx`: Number of pixels in this region
  - `bbox`: Bounding box of the region
    - `x0`: Minimum x coordinate (inclusive)
    - `y0`: Minimum y coordinate (inclusive)
    - `x1`: Maximum x coordinate (exclusive)
    - `y1`: Maximum y coordinate (exclusive)
  - `contours`: Array of polylines (contours) for this region
    - Each contour is an array of `{x, y}` points in image pixel coordinates
    - Contours are closed (first and last points are the same)
    - Multiple contours per region are possible (e.g., for regions with holes)
- `method`: Quantization method used (`lab-kmeans-deltae76-contours`)
- `indexedPreviewPngBase64` (optional): Base64-encoded PNG preview image showing quantized result. Only present when `returnPreview: true`.

**Notes:**
- Uses k-means clustering in Lab color space for perceptually uniform quantization
- Palette colors are sorted by pixel count (most common first)
- Each palette color includes a DMC thread match using the same matching algorithm as `match_dmc`
- Supports both session mode (using `imageId`) and one-shot mode (using `imageBase64`)
- Images are automatically resized to `maxSize` for memory efficiency
- **Deterministic output**: Same input + same `seed` produces identical results. Default seed is `42`.
- **Contour extraction**: Uses border-following algorithm (Moore neighborhood tracing) to extract region boundaries as polylines. Contours are extracted in image pixel coordinates.
- **Region cleanup**: When `minRegionArea > 0`, performs connected-components analysis (4-connected) and merges small regions into neighboring regions using majority adjacency. This reduces confetti artifacts from quantization.
- **Phase 2 implementation**: Includes contour extraction, but no SVG generation, no text labels

## Adding a New Tool

To add a new tool, follow this template:

1. **Create tool file** (`src/tools/my_tool.ts`):

```typescript
export interface MyToolInput {
    // Define input schema
}

export interface MyToolOutput {
    // Define output schema
}

export function myToolHandler(input: MyToolInput): MyToolOutput {
    // Implement handler logic
    return {
        // Return output
    };
}

export const myTool = {
    name: "my_tool",
    description: "Tool description",
    inputSchema: {
        type: "object",
        properties: {
            // Define properties
        },
        required: ["required_field"],
    },
};
```

2. **Add to tools aggregator** (`src/tools/index.ts`):

```typescript
import { myTool, myToolHandler, type MyToolInput } from "./my_tool.js";

// Add to tools array
export const tools: ToolDefinition[] = [
    // ... existing tools
    myTool,
];

// Add to toolHandlers map
export const toolHandlers: Record<string, ToolHandler> = {
    // ... existing handlers
    my_tool: (args: unknown) => myToolHandler(args as MyToolInput),
};
```

3. **Add handler in** `src/index.ts`:

```typescript
if (toolName === "my_tool") {
    const schema = z.object({
        // Define zod schema matching inputSchema
    });

    const parseResult = schema.safeParse(request.params.arguments);
    if (!parseResult.success) {
        throw new McpError(
            ErrorCode.InvalidParams,
            "Invalid parameters for my_tool"
        );
    }

    const result = toolHandlers.my_tool(parseResult.data);
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(result, null, 2),
            },
        ],
    };
}
```

4. **Add tests** (`src/tools/__tests__/my_tool.test.ts`):

```typescript
import { describe, it, expect } from 'vitest';
import { myToolHandler } from '../my_tool.js';

describe('my_tool', () => {
    it('should handle input correctly', () => {
        const result = myToolHandler({ /* test input */ });
        expect(result).toBeDefined();
        // Add assertions
    });
});
```

## Project Structure

```
src/
├── index.ts              # MCP server entry point
├── tools/
│   ├── index.ts         # Tools aggregator
│   ├── ping.ts          # Ping tool
│   ├── match_dmc.ts     # DMC matching tool
│   ├── vision.ts         # Image analysis
│   ├── vibe.ts           # Aesthetic profiles
│   ├── pattern.ts        # Pattern generation
│   └── __tests__/        # Unit tests
├── lib/                  # Shared libraries
└── data/                 # Data files (e.g., dmc.json)
```

## DMC Dataset

The `match_dmc` tool requires a DMC dataset file at `src/data/dmc.json`. The expected format:

```json
[
  {
    "id": "DMC-666",
    "name": "Bright Christmas Red",
    "hex": "#FF0000",
    "rgb": { "r": 255, "g": 0, "b": 0 }
  },
  ...
]
```

If the dataset is not available, the tool will return an error indicating where it should be placed.

## Testing

Run unit tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Tests use Vitest and can call handlers directly without requiring an MCP client.

## Demo UI

A minimal web demo UI is available to test the blueprint generation functionality.

### Running the Demo

Start the demo server:

```bash
npm run demo
```

This will start a simple HTTP server on `http://localhost:3001`. Open the URL in your browser to access the demo UI.

### Demo Features

The demo UI provides:

- **Image Upload**: Drag and drop or click to upload an image
- **Palette Size Slider**: Adjust the number of colors (2-30, default: 15)
- **Min Region Area Slider**: Control region cleanup threshold (0-500, default: 100)
- **Generate Button**: Process the image and generate a blueprint
- **Preview Display**: Shows the quantized preview image
- **Palette List**: Displays all colors with:
  - Color swatch
  - Hex color code
  - DMC thread match (ID and name)
  - Percentage of image covered

### Demo Architecture

The demo consists of:

- `demo/server.ts`: Simple HTTP server wrapper that exposes `generate_blueprint_v1` handler via REST API
- `demo/index.html`: Standalone web UI that communicates with the server via fetch API

The demo server runs independently from the main MCP server and can be used for testing and demonstration purposes.

### Building the Demo

To build the demo for production:

```bash
npm run demo:build
npm run demo:start
```

## ThreeJS Live Blueprint UI

A production-grade Next.js UI with Three.js for realtime blueprint preview and interaction.

### Running the ThreeJS UI

**Prerequisites:**
1. Start the demo server (required for API endpoints):
   ```bash
   npm run demo
   ```
   This runs on `http://localhost:3001` by default.
   
   To use a different port:
   ```bash
   DEMO_PORT=3003 npm run demo
   ```

2. In a separate terminal, start the Next.js dev server:
   ```bash
   npm run next:dev
   ```
   This runs on `http://localhost:3000` by default.

3. Open `http://localhost:3000/three-blueprint` in your browser.

**Note:** If your demo server runs on a different port, set `NEXT_PUBLIC_DEMO_ORIGIN` in `.env.local`:
```
NEXT_PUBLIC_DEMO_ORIGIN=http://localhost:3003
```

### Building for Production

```bash
npm run next:build
npm run next:start
```

### Features

- **Realtime Preview**: Three.js canvas with instant updates as you adjust parameters
- **Two-Stage Rendering**: 
  - Fast preview (512px) while dragging sliders
  - Final preview (2048px) after user stops adjusting
- **Smart Caching**: LRU cache prevents redundant API calls
- **Request Cancellation**: AbortController cancels stale requests automatically
- **Color Highlighting**: Click palette swatches to highlight that color in the preview
- **Mobile-Friendly**: Touch-safe controls and responsive layout
- **Debounced Controls**: Smooth interaction without flickering

### Architecture

The ThreeJS UI is built with:

- **Next.js 16** (App Router)
- **React Three Fiber** (`@react-three/fiber`) for Three.js integration
- **Drei** (`@react-three/drei`) for helpers (OrbitControls, Grid)
- **Zustand** for state management
- **Tailwind CSS** for styling

### File Structure

```
app/
├── three-blueprint/
│   └── page.tsx              # Main page component
├── layout.tsx                 # Root layout
└── globals.css                # Global styles

components/
├── three/
│   ├── BlueprintCanvas.tsx    # Three.js canvas wrapper
│   └── TexturePlane.tsx      # Shader-based texture plane with highlighting
├── controls/
│   └── BlueprintControls.tsx # Parameter sliders and controls
└── palette/
    └── PalettePanel.tsx      # Color swatches with DMC matches

lib/
├── api/
│   └── blueprint.ts          # API client helpers
└── preview/
    └── texture.ts            # Base64 to Three.js texture utilities

store/
└── blueprintStore.ts         # Zustand store for state management
```

### API Endpoints Required

The UI expects the demo server (`demo/server.ts`) to be running with these endpoints:

- `POST /api/image-register`: Register image and get `imageId`
  - Input: `{ imageBase64: string, maxSize?: number }`
  - Output: `{ ok: boolean, imageId?: string, width?: number, height?: number }`

- `POST /api/generate-blueprint-v1`: Generate blueprint
  - Input: `{ imageId: string, paletteSize: number, maxSize?: number, seed?: number, returnPreview?: boolean, minRegionArea?: number, mergeSmallRegions?: boolean }`
  - Output: `{ ok: boolean, palette?: PaletteColor[], indexedPreviewPngBase64?: string }`

### Configuration

Set the API base URL via environment variable:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001 npm run next:dev
```

Defaults to `http://localhost:3001` if not set.

### Performance Optimizations

- **Debouncing**: 300ms delay before triggering preview generation
- **Two-stage rendering**: Fast preview (512px) → Final preview (2048px) after 700ms pause
- **Request cancellation**: AbortController cancels stale requests
- **Response caching**: LRU cache (max 20 entries) prevents redundant API calls
- **Request ID guards**: Ignores stale responses using request ID tracking
- **Texture disposal**: Properly disposes Three.js textures to prevent memory leaks
- **Nearest-neighbor filtering**: Crisp pixel rendering for indexed previews

## License

ISC
