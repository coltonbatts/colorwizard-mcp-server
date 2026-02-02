/**
 * Client-side API helpers for blueprint generation
 */

// Use NEXT_PUBLIC_DEMO_ORIGIN for explicit demo server origin
// Defaults to http://localhost:3001 to match demo/server.ts default port
// Can be overridden via NEXT_PUBLIC_DEMO_ORIGIN env var or DEMO_PORT env var on server side
const DEMO_ORIGIN = process.env.NEXT_PUBLIC_DEMO_ORIGIN || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'http://localhost:3001' 
    : 'http://localhost:3001');

// Export for diagnostics display
export const getDemoOrigin = () => DEMO_ORIGIN;

// Module-level variable to track mock mode (set from page component)
// PRODUCTION SAFETY: Initialize to false - production must never start in mock mode
let mockModeEnabled = false;

/**
 * Set mock mode (called from page component)
 * 
 * PRODUCTION SAFETY: In production, this will enforce mockMode=false
 */
export function setMockModeEnabled(enabled: boolean): void {
  // CRITICAL: Production safety guard - never allow mock mode in production
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
    mockModeEnabled = false;
    return;
  }
  mockModeEnabled = enabled;
}

/**
 * Check if mock mode is enabled
 * 
 * PRODUCTION SAFETY: Always returns false in production, regardless of any other state
 */
function isMockMode(): boolean {
  // CRITICAL: Production safety guard - never enable mock mode in production
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
    return false;
  }
  
  // In development, check both the module variable and env var
  // The module variable takes precedence (set by page component)
  if (mockModeEnabled) {
    return true;
  }
  
  // Fallback to env var check (for initial load before useEffect runs)
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_BLUEPRINT_MOCK === '1') {
    return true;
  }
  
  return false;
}

/**
 * Simulate network latency
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert image URL/base64 to base64 PNG
 */
async function imageToBase64(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      try {
        const base64 = canvas.toDataURL('image/png');
        // Remove data:image/png;base64, prefix
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
}

/**
 * Generate mock palette colors based on paletteSize
 */
function generateMockPalette(paletteSize: number, seed: number = 42): PaletteColor[] {
  // Use seed for deterministic randomness
  let rng = seed;
  const next = () => {
    rng = (rng * 9301 + 49297) % 233280;
    return rng / 233280;
  };

  // Generate diverse colors
  const colors: PaletteColor[] = [];
  const totalPercent = 100;
  let remainingPercent = totalPercent;

  // Sample DMC colors for realistic matches
  const dmcColors = [
    { id: 'DMC-666', name: 'Bright Christmas Red', rgb: [227, 29, 66] },
    { id: 'DMC-703', name: 'Chartreuse', rgb: [127, 179, 71] },
    { id: 'DMC-798', name: 'Delft Blue Dark', rgb: [30, 58, 138] },
    { id: 'DMC-310', name: 'Black', rgb: [0, 0, 0] },
    { id: 'DMC-520', name: 'Fern Green Dark', rgb: [64, 81, 26] },
    { id: 'DMC-666', name: 'Bright Christmas Red', rgb: [227, 29, 66] },
    { id: 'DMC-704', name: 'Chartreuse Bright', rgb: [135, 198, 83] },
    { id: 'DMC-321', name: 'Christmas Red', rgb: [199, 43, 59] },
    { id: 'DMC-701', name: 'Green Light', rgb: [127, 179, 71] },
    { id: 'DMC-702', name: 'Green', rgb: [107, 142, 35] },
    { id: 'DMC-800', name: 'Delft Blue Pale', rgb: [96, 165, 250] },
    { id: 'DMC-347', name: 'Salmon Very Dark', rgb: [191, 31, 44] },
  ];

  for (let i = 0; i < paletteSize; i++) {
    const isLast = i === paletteSize - 1;
    const percent = isLast ? remainingPercent : Math.max(1, Math.floor(remainingPercent * (0.5 + next() * 0.5)));
    remainingPercent -= percent;

    // Generate RGB color (vary saturation and brightness)
    const hue = (i * 360) / paletteSize + next() * 30;
    const saturation = 0.5 + next() * 0.5;
    const lightness = 0.3 + next() * 0.4;

    // Convert HSL to RGB (simplified)
    const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = lightness - c / 2;

    let r = 0, g = 0, b = 0;
    if (hue < 60) { r = c; g = x; b = 0; }
    else if (hue < 120) { r = x; g = c; b = 0; }
    else if (hue < 180) { r = 0; g = c; b = x; }
    else if (hue < 240) { r = 0; g = x; b = c; }
    else if (hue < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    const rgb: [number, number, number] = [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
    ];

    // Find closest DMC match
    const dmcMatch = dmcColors[i % dmcColors.length];
    const deltaE = 5 + next() * 15; // Simulated deltaE

    // Convert RGB to LAB (simplified approximation)
    const lab: [number, number, number] = [
      50 + next() * 50, // L
      -50 + next() * 100, // a
      -50 + next() * 100, // b
    ];

    colors.push({
      rgb,
      hex: `#${rgb[0].toString(16).padStart(2, '0')}${rgb[1].toString(16).padStart(2, '0')}${rgb[2].toString(16).padStart(2, '0')}`,
      lab,
      count: Math.floor(percent * 1000),
      percent: percent,
      dmcMatch: {
        ok: true,
        best: {
          id: dmcMatch.id,
          name: dmcMatch.name,
          rgb: dmcMatch.rgb,
          deltaE: deltaE,
        },
        alternatives: [],
        method: 'lab-d65-deltae76',
      },
    });
  }

  return colors;
}

/**
 * Mock implementation of registerImage
 */
async function mockRegisterImage(
  input: ImageRegisterInput,
  signal?: AbortSignal
): Promise<ImageRegisterResponse> {
  // Simulate latency
  await delay(50 + Math.random() * 50);

  if (signal?.aborted) {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    throw abortError;
  }

  // Extract image dimensions from base64 if possible, otherwise use defaults
  let width = 800;
  let height = 600;

  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = input.imageBase64;
    });
    width = img.width;
    height = img.height;
  } catch {
    // Use defaults if image parsing fails
  }

  // Return stable imageId based on image content hash (simplified)
  const imageId = `mock-${btoa(input.imageBase64.substring(0, 100)).substring(0, 16)}`;

  return {
    ok: true,
    imageId,
    width,
    height,
  };
}

/**
 * Mock implementation of generateBlueprintV1
 * 
 * ROBUSTNESS GUARANTEES:
 * - Returns exactly paletteSize entries
 * - Percentages sum to ~100.0 (normalized)
 * - Deterministic output given same seed
 * - indexedPreviewPngBase64 in correct format (base64 PNG without data: prefix)
 * - Latency simulation does NOT block final preview completion (async + abort signals)
 */
async function mockGenerateBlueprintV1(
  input: GenerateBlueprintV1Input,
  signal?: AbortSignal,
  originalImageUrl?: string
): Promise<GenerateBlueprintV1Response> {
  // Simulate latency: fast ~80-150ms, final ~250-500ms
  // NOTE: This delay is async and respects abort signals, so it does NOT block
  // final preview completion - requests can be cancelled and new ones started immediately
  const isFast = (input.maxSize || 2048) <= 512;
  const latency = isFast 
    ? 80 + Math.random() * 70 
    : 250 + Math.random() * 250;
  
  await delay(latency);

  // Check abort signal after delay (allows cancellation)
  if (signal?.aborted) {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    throw abortError;
  }

  // Generate palette with exactly paletteSize entries
  const palette = generateMockPalette(input.paletteSize, input.seed || 42);

  // ROBUSTNESS: Normalize percentages to sum to exactly 100.0
  // This ensures the response is always valid regardless of rounding errors
  const totalPercent = palette.reduce((sum, c) => sum + c.percent, 0);
  if (totalPercent > 0) {
    palette.forEach((c) => {
      c.percent = (c.percent / totalPercent) * 100;
    });
  }

  // Generate indexed preview base64
  let indexedPreviewPngBase64: string | undefined;
  if (input.returnPreview && originalImageUrl) {
    try {
      indexedPreviewPngBase64 = await imageToBase64(originalImageUrl);
    } catch (err) {
      console.warn('Failed to convert image to base64:', err);
    }
  }

  return {
    ok: true,
    palette,
    totalPixels: palette.reduce((sum, c) => sum + c.count, 0),
    method: 'lab-kmeans-deltae76',
    indexedPreviewPngBase64,
  };
}

export interface ImageRegisterInput {
  imageBase64: string;
  maxSize?: number;
}

export interface ImageRegisterResponse {
  ok: boolean;
  imageId?: string;
  width?: number;
  height?: number;
  error?: string;
}

export interface GenerateBlueprintV1Input {
  imageId: string;
  paletteSize: number;
  maxSize?: number;
  seed?: number;
  returnPreview?: boolean;
  minRegionArea?: number;
  mergeSmallRegions?: boolean;
}

export interface PaletteColor {
  rgb: [number, number, number];
  hex: string;
  lab: [number, number, number];
  count: number;
  percent: number;
  dmcMatch: {
    ok: boolean;
    best?: {
      id: string;
      name: string;
      rgb: [number, number, number];
      deltaE?: number;
    };
    alternatives?: Array<{
      id: string;
      name: string;
      rgb: [number, number, number];
      deltaE?: number;
    }>;
    method?: string;
  };
}

export interface GenerateBlueprintV1Response {
  ok: boolean;
  palette?: PaletteColor[];
  totalPixels?: number;
  method?: string;
  indexedPreviewPngBase64?: string;
  error?: string;
}

/**
 * Register an image and get an imageId
 */
export async function registerImage(
  input: ImageRegisterInput,
  signal?: AbortSignal
): Promise<ImageRegisterResponse> {
  // Check if mock mode is enabled
  if (isMockMode()) {
    return mockRegisterImage(input, signal);
  }

  const endpoint = `${DEMO_ORIGIN}/api/image-register`;
  let response: Response;
  
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      signal,
    });
  } catch (err) {
    // Connection refused, network error, etc.
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(
      `Cannot reach demo server at ${DEMO_ORIGIN}. ` +
      `Error: ${errorMessage}. ` +
      `Make sure the demo server is running: npm run demo (default port: 3001, override with DEMO_PORT env var). ` +
      `Or set NEXT_PUBLIC_DEMO_ORIGIN to match your server port.`
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Demo server error (${DEMO_ORIGIN}): HTTP ${response.status}: ${errorText || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Generate blueprint v1 with caching and request cancellation support
 */
export async function generateBlueprintV1(
  input: GenerateBlueprintV1Input,
  signal?: AbortSignal,
  originalImageUrl?: string
): Promise<GenerateBlueprintV1Response> {
  // Check if mock mode is enabled
  if (isMockMode()) {
    return mockGenerateBlueprintV1(input, signal, originalImageUrl);
  }

  const endpoint = `${DEMO_ORIGIN}/api/generate-blueprint-v1`;
  let response: Response;
  
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      signal,
    });
  } catch (err) {
    // Connection refused, network error, etc.
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(
      `Cannot reach demo server at ${DEMO_ORIGIN}. ` +
      `Error: ${errorMessage}. ` +
      `Make sure the demo server is running: npm run demo (default port: 3001, override with DEMO_PORT env var). ` +
      `Or set NEXT_PUBLIC_DEMO_ORIGIN to match your server port.`
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Demo server error (${DEMO_ORIGIN}): HTTP ${response.status}: ${errorText || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Generate a cache key from input parameters
 */
export function getCacheKey(input: GenerateBlueprintV1Input, mode: 'fast' | 'final'): string {
  return JSON.stringify({
    imageId: input.imageId,
    paletteSize: input.paletteSize,
    maxSize: input.maxSize,
    seed: input.seed,
    minRegionArea: input.minRegionArea,
    mergeSmallRegions: input.mergeSmallRegions,
    mode,
  });
}
