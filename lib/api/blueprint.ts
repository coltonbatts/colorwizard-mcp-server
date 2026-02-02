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

// Export env var status for debugging
export const getDemoOriginDebug = () => ({
  origin: DEMO_ORIGIN,
  envVar: process.env.NEXT_PUBLIC_DEMO_ORIGIN || null,
  isDefault: !process.env.NEXT_PUBLIC_DEMO_ORIGIN,
});

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
 * DMC dataset entry interface
 */
interface DmcDatasetEntry {
  id: string;
  name: string;
  hex: string;
}

/**
 * DMC entry with RGB values
 */
interface DmcEntryWithRgb {
  id: string;
  name: string;
  hex: string;
  rgb: [number, number, number];
}

/**
 * Cached DMC dataset (loaded once)
 */
let dmcDatasetCache: DmcEntryWithRgb[] | null = null;

/**
 * Load DMC dataset from public folder (cached after first load)
 */
async function loadDmcDataset(): Promise<DmcEntryWithRgb[]> {
  if (dmcDatasetCache !== null) {
    return dmcDatasetCache;
  }

  try {
    const response = await fetch('/dmc.json');
    if (!response.ok) {
      throw new Error(`Failed to load DMC dataset: ${response.status}`);
    }
    const entries: DmcDatasetEntry[] = await response.json();
    
    // Convert hex to RGB
    dmcDatasetCache = entries.map((entry) => {
      const hex = entry.hex.replace(/^#/, '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return {
        id: entry.id,
        name: entry.name,
        hex: entry.hex,
        rgb: [r, g, b] as [number, number, number],
      };
    });
    
    return dmcDatasetCache;
  } catch (error) {
    console.error('Failed to load DMC dataset:', error);
    // Fallback to empty array if dataset fails to load
    dmcDatasetCache = [];
    return dmcDatasetCache;
  }
}

/**
 * Convert hex to RGB
 */
function hexToRgb(hex: string): [number, number, number] | null {
  const cleaned = hex.replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return null;
  }
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return [r, g, b];
}

/**
 * Calculate RGB distance (Euclidean distance in RGB space)
 * Fast approximation for mock mode (Lab would be more accurate but slower)
 */
function rgbDistance(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const dr = rgb1[0] - rgb2[0];
  const dg = rgb1[1] - rgb2[1];
  const db = rgb1[2] - rgb2[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Find nearest DMC color to a given RGB value
 */
function findNearestDmc(rgb: [number, number, number], palette: DmcEntryWithRgb[]): DmcEntryWithRgb {
  let nearest = palette[0];
  let minDistance = rgbDistance(rgb, palette[0].rgb);
  
  for (let i = 1; i < palette.length; i++) {
    const distance = rgbDistance(rgb, palette[i].rgb);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = palette[i];
    }
  }
  
  return nearest;
}

/**
 * Load image and return ImageData (cached by URL)
 */
const imageDataCache = new Map<string, ImageData>();

async function loadImageData(imageUrl: string, maxSize: number = 2048): Promise<ImageData> {
  const cacheKey = `${imageUrl}:${maxSize}`;
  if (imageDataCache.has(cacheKey)) {
    return imageDataCache.get(cacheKey)!;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Downscale if needed
      let width = img.width;
      let height = img.height;
      const scale = Math.min(1, maxSize / Math.max(width, height));
      if (scale < 1) {
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      imageDataCache.set(cacheKey, imageData);
      resolve(imageData);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
}

/**
 * Recolor image using DMC palette colors
 * Maps each pixel to the nearest DMC color in the palette
 */
function recolorImageWithDmcPalette(
  imageData: ImageData,
  palette: DmcEntryWithRgb[]
): ImageData {
  const { data, width, height } = imageData;
  const output = new ImageData(width, height);
  const outputData = output.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    // Find nearest DMC color and set output pixel to DMC RGB
    const nearest = findNearestDmc([r, g, b], palette);
    outputData[i] = nearest.rgb[0];
    outputData[i + 1] = nearest.rgb[1];
    outputData[i + 2] = nearest.rgb[2];
    outputData[i + 3] = a;
  }
  
  return output;
}

/**
 * Convert ImageData to base64 PNG
 */
function imageDataToBase64(imageData: ImageData): string {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  ctx.putImageData(imageData, 0, 0);
  const base64 = canvas.toDataURL('image/png');
  // Remove data:image/png;base64, prefix
  return base64.split(',')[1];
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
 * Generate deterministic RNG from seed
 */
function createRng(seed: number): () => number {
  let rng = seed;
  return () => {
    rng = (rng * 9301 + 49297) % 233280;
    return rng / 233280;
  };
}

/**
 * Select DMC palette entries deterministically based on seed
 * Uses seed to select diverse colors from the full DMC dataset
 */
function selectDmcPalette(
  dmcDataset: DmcEntryWithRgb[],
  paletteSize: number,
  seed: number
): DmcEntryWithRgb[] {
  if (dmcDataset.length === 0) {
    // Fallback if dataset failed to load
    return [];
  }
  
  const next = createRng(seed);
  const selected: DmcEntryWithRgb[] = [];
  const usedIndices = new Set<number>();
  
  // Select diverse colors by sampling across the dataset
  for (let i = 0; i < paletteSize; i++) {
    let index: number;
    let attempts = 0;
    do {
      // Sample across the dataset with some randomness
      const baseIndex = Math.floor((i / paletteSize) * dmcDataset.length);
      const offset = Math.floor(next() * Math.min(50, dmcDataset.length / paletteSize));
      index = (baseIndex + offset) % dmcDataset.length;
      attempts++;
    } while (usedIndices.has(index) && attempts < 100);
    
    usedIndices.add(index);
    selected.push(dmcDataset[index]);
  }
  
  return selected;
}

/**
 * Convert RGB to Lab (simplified approximation for mock mode)
 * This is a fast approximation - for accuracy, use proper Lab conversion
 */
function rgbToLabApprox(rgb: [number, number, number]): [number, number, number] {
  // Normalize RGB to 0-1
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  
  // Simple approximation (not accurate but fast for mock mode)
  const l = (r + g + b) / 3 * 100;
  const a = (r - g) * 127;
  const b_lab = (g - b) * 127;
  
  return [l, a, b_lab];
}

/**
 * Generate mock palette using real DMC entries
 * Returns palette colors with DMC data and initial percentage distribution
 */
async function generateMockPalette(
  paletteSize: number,
  seed: number = 42,
  imageData?: ImageData
): Promise<PaletteColor[]> {
  // Load DMC dataset
  const dmcDataset = await loadDmcDataset();
  if (dmcDataset.length === 0) {
    throw new Error('DMC dataset failed to load');
  }
  
  // Select DMC entries deterministically
  const selectedDmc = selectDmcPalette(dmcDataset, paletteSize, seed);
  
  // If we have image data, count actual pixel usage
  // Otherwise, generate synthetic distribution
  const next = createRng(seed + 1000); // Different seed for distribution
  const colorCounts = new Map<number, number>();
  
  if (imageData) {
    // Count pixels per palette color
    const { data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Find nearest DMC color in palette
      const nearest = findNearestDmc([r, g, b], selectedDmc);
      const index = selectedDmc.indexOf(nearest);
      colorCounts.set(index, (colorCounts.get(index) || 0) + 1);
    }
  } else {
    // Synthetic distribution
    let remaining = 10000; // Use 10000 as base for percentages
    for (let i = 0; i < paletteSize; i++) {
      const isLast = i === paletteSize - 1;
      const count = isLast ? remaining : Math.max(100, Math.floor(remaining * (0.3 + next() * 0.4)));
      colorCounts.set(i, count);
      remaining -= count;
    }
  }
  
  // Build palette colors
  const totalPixels = Array.from(colorCounts.values()).reduce((sum, count) => sum + count, 0);
  const colors: PaletteColor[] = [];
  
  for (let i = 0; i < selectedDmc.length; i++) {
    const dmc = selectedDmc[i];
    const count = colorCounts.get(i) || 0;
    const percent = totalPixels > 0 ? (count / totalPixels) * 100 : 0;
    
    colors.push({
      rgb: dmc.rgb,
      hex: dmc.hex,
      lab: rgbToLabApprox(dmc.rgb),
      count: count,
      percent: percent,
      dmcMatch: {
        ok: true,
        best: {
          id: dmc.id,
          name: dmc.name,
          rgb: dmc.rgb,
          deltaE: 0, // Exact match since we're using DMC colors
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
 * INSTANT: Returns immediately without any delays or blocking operations
 */
async function mockRegisterImage(
  input: ImageRegisterInput,
  signal?: AbortSignal
): Promise<ImageRegisterResponse> {
  // Check abort signal immediately
  if (signal?.aborted) {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    throw abortError;
  }

  // Return stable imageId based on image content hash (simplified)
  // Use a fast hash - just take first few chars and create a simple ID
  let imageId: string;
  try {
    // Fast hash: use first 50 chars of base64 (skip data: prefix if present)
    const base64Data = input.imageBase64.includes(',') 
      ? input.imageBase64.split(',')[1] 
      : input.imageBase64;
    const hashInput = base64Data.substring(0, Math.min(50, base64Data.length));
    // Simple hash - just use the base64 chars directly (they're already safe)
    imageId = `mock-${hashInput.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16)}`;
    if (!imageId || imageId === 'mock-') {
      imageId = `mock-${Date.now().toString(36)}`;
    }
  } catch (err) {
    // Fallback to timestamp-based ID
    imageId = `mock-${Date.now().toString(36)}`;
  }

  // Return immediately with defaults - dimensions don't matter for mock mode
  // The actual image will be loaded later when generating the blueprint
  // Use microtask to ensure it's truly async but instant
  return {
    ok: true,
    imageId,
    width: 800, // Default dimensions - actual image will be loaded later
    height: 600,
  };
}

/**
 * Cache for mock blueprint outputs (keyed by imageId + paletteSize + seed + maxSize)
 */
const mockBlueprintCache = new Map<string, GenerateBlueprintV1Response>();

/**
 * Mock implementation of generateBlueprintV1
 * 
 * ROBUSTNESS GUARANTEES:
 * - Returns exactly paletteSize entries
 * - Percentages sum to exactly 100.0 (normalized and fixed)
 * - Deterministic output given same seed
 * - indexedPreviewPngBase64 in correct format (base64 PNG without data: prefix)
 * - Preview uses actual DMC RGB values
 * - Thread list matches preview exactly
 * - Latency simulation does NOT block final preview completion (async + abort signals)
 */
async function mockGenerateBlueprintV1(
  input: GenerateBlueprintV1Input,
  signal?: AbortSignal,
  originalImageUrl?: string
): Promise<GenerateBlueprintV1Response> {
  // Check cache first
  const cacheKey = JSON.stringify({
    imageId: input.imageId,
    paletteSize: input.paletteSize,
    seed: input.seed || 42,
    maxSize: input.maxSize || 2048,
    returnPreview: input.returnPreview,
  });
  
  if (mockBlueprintCache.has(cacheKey)) {
    const cached = mockBlueprintCache.get(cacheKey)!;
    // If includeDmc changed, we still need to regenerate DMC matches
    if (input.includeDmc !== false || cached.palette?.every(c => c.dmcMatch.ok)) {
      return cached;
    }
  }

  // Simulate latency: fast ~80-150ms, final ~250-500ms
  // NOTE: This delay is async and respects abort signals, so it does NOT block
  // final preview completion - requests can be cancelled and new requests started immediately
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

  // Determine image source
  const imageUrl = originalImageUrl || '/mock/sample.jpg';
  const maxSize = input.maxSize || (isFast ? 512 : 2048);

  // Load image data
  let imageData: ImageData | undefined;
  if (input.returnPreview) {
    try {
      imageData = await loadImageData(imageUrl, maxSize);
    } catch (err) {
      console.warn('Failed to load image for mock preview:', err);
      // Fallback to sample image if original fails
      if (originalImageUrl && originalImageUrl !== '/mock/sample.jpg') {
        try {
          imageData = await loadImageData('/mock/sample.jpg', maxSize);
        } catch (fallbackErr) {
          console.warn('Failed to load fallback image:', fallbackErr);
        }
      }
    }
  }

  // Generate palette using real DMC entries
  // If we have image data, palette will be based on actual image colors
  const palette = await generateMockPalette(
    input.paletteSize,
    input.seed || 42,
    imageData
  );

  // If includeDmc is false, remove DMC matches for faster response
  if (input.includeDmc === false) {
    palette.forEach((c) => {
      c.dmcMatch = { ok: false };
    });
  }

  // Recolor image using DMC palette
  let indexedPreviewPngBase64: string | undefined;
  if (input.returnPreview && imageData) {
    try {
      // Extract DMC entries from palette for recoloring
      const dmcPalette: DmcEntryWithRgb[] = palette.map((c) => ({
        id: c.dmcMatch.best?.id || '',
        name: c.dmcMatch.best?.name || '',
        hex: c.hex,
        rgb: c.rgb,
      }));

      // Recolor image
      const recoloredImageData = recolorImageWithDmcPalette(imageData, dmcPalette);
      
      // Convert to base64
      indexedPreviewPngBase64 = imageDataToBase64(recoloredImageData);
    } catch (err) {
      console.warn('Failed to recolor image:', err);
    }
  }

  // ROBUSTNESS: Fix percentages to sum to exactly 100.0
  // Calculate total and normalize
  const totalPercent = palette.reduce((sum, c) => sum + c.percent, 0);
  if (totalPercent > 0) {
    // Normalize all percentages
    palette.forEach((c) => {
      c.percent = (c.percent / totalPercent) * 100;
    });
    
    // Fix rounding drift by adjusting the largest bucket
    const actualTotal = palette.reduce((sum, c) => sum + c.percent, 0);
    const drift = 100.0 - actualTotal;
    if (Math.abs(drift) > 0.001) {
      // Find largest bucket and adjust it
      let maxIndex = 0;
      let maxPercent = palette[0].percent;
      for (let i = 1; i < palette.length; i++) {
        if (palette[i].percent > maxPercent) {
          maxPercent = palette[i].percent;
          maxIndex = i;
        }
      }
      palette[maxIndex].percent += drift;
    }
  } else {
    // If no pixels, distribute evenly
    const evenPercent = 100.0 / palette.length;
    palette.forEach((c) => {
      c.percent = evenPercent;
    });
    // Fix last one for exact 100
    palette[palette.length - 1].percent += 100.0 - (evenPercent * palette.length);
  }

  // Ensure no negative percentages
  palette.forEach((c) => {
    if (c.percent < 0) {
      c.percent = 0;
    }
  });

  // Recalculate counts based on final percentages
  const totalPixels = palette.reduce((sum, c) => sum + c.count, 0);
  if (totalPixels > 0) {
    palette.forEach((c) => {
      c.count = Math.round((c.percent / 100) * totalPixels);
    });
  }

  const response: GenerateBlueprintV1Response = {
    ok: true,
    palette,
    totalPixels: palette.reduce((sum, c) => sum + c.count, 0),
    method: 'lab-kmeans-deltae76',
    indexedPreviewPngBase64,
  };

  // Cache the response
  mockBlueprintCache.set(cacheKey, response);

  return response;
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
  includeDmc?: boolean; // If false, skip DMC matching for faster responses
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
  
  // Create abort controller with timeout (60 seconds for large images)
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 60000);
  
  // Combine signals: use provided signal if available, otherwise use timeout signal
  const fetchSignal = signal || timeoutController.signal;
  
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      signal: fetchSignal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    // Connection refused, network error, timeout, etc.
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    if (err instanceof Error && err.name === 'AbortError') {
      if (timeoutController.signal.aborted) {
        throw new Error(
          `Request timeout after 60 seconds. The image may be too large. ` +
          `Try enabling Mock Mode in Advanced Options for faster testing.`
        );
      }
      throw new Error(
        `Request cancelled: Cannot reach demo server at ${DEMO_ORIGIN}. ` +
        `Make sure the demo server is running: npm run demo (default port: 3001). ` +
        `Or enable Mock Mode in Advanced Options.`
      );
    }
    throw new Error(
      `Cannot reach demo server at ${DEMO_ORIGIN}. ` +
      `Error: ${errorMessage}. ` +
      `Make sure the demo server is running: npm run demo (default port: 3001, override with DEMO_PORT env var). ` +
      `Or set NEXT_PUBLIC_DEMO_ORIGIN to match your server port. ` +
      `Or enable Mock Mode in Advanced Options.`
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
 * Load DMC matches for a batch of colors (for progressive loading)
 */
export async function loadDmcMatchesBatch(
  colors: Array<{ r: number; g: number; b: number }>,
  signal?: AbortSignal
): Promise<Array<{ ok: boolean; best?: any; alternatives?: any[]; method?: string }>> {
  if (isMockMode()) {
    // In mock mode, generate matches synchronously
    return colors.map((rgb) => {
      // Simple mock match
      return {
        ok: true,
        best: {
          id: `DMC-${Math.floor(Math.random() * 900) + 100}`,
          name: 'Mock Thread',
          rgb: [rgb.r, rgb.g, rgb.b],
          deltaE: Math.random() * 10,
        },
        alternatives: [],
        method: 'lab-d65-deltae76',
      };
    });
  }

  const endpoint = `${DEMO_ORIGIN}/api/match-dmc-batch`;
  let response: Response;
  
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ colors }),
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(
      `Cannot reach demo server at ${DEMO_ORIGIN}. ` +
      `Error: ${errorMessage}.`
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Demo server error (${DEMO_ORIGIN}): HTTP ${response.status}: ${errorText || response.statusText}`
    );
  }

  const result = await response.json();
  if (!result.ok || !Array.isArray(result.matches)) {
    throw new Error('Invalid response from DMC batch endpoint');
  }

  return result.matches;
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
