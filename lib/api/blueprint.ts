/**
 * Client-side API helpers for blueprint generation
 */

// Use NEXT_PUBLIC_DEMO_ORIGIN for explicit demo server origin
// Defaults to http://localhost:3001 in development
const DEMO_ORIGIN = process.env.NEXT_PUBLIC_DEMO_ORIGIN || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'http://localhost:3001' 
    : 'http://localhost:3001');

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
  const response = await fetch(`${DEMO_ORIGIN}/api/image-register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
  }

  return response.json();
}

/**
 * Generate blueprint v1 with caching and request cancellation support
 */
export async function generateBlueprintV1(
  input: GenerateBlueprintV1Input,
  signal?: AbortSignal
): Promise<GenerateBlueprintV1Response> {
  const response = await fetch(`${DEMO_ORIGIN}/api/generate-blueprint-v1`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
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
