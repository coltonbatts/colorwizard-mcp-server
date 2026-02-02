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

## License

ISC
