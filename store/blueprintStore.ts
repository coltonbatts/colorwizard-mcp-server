/**
 * Zustand store for blueprint state management
 */

import { create } from 'zustand';
import type { PaletteColor, GenerateBlueprintV1Response } from '@/lib/api/blueprint';

export interface BlueprintParams {
  paletteSize: number;
  minRegionArea: number;
  mergeSmallRegions: boolean;
  seed: number;
}

export interface BlueprintState {
  // Image state
  imageId: string | null;
  originalPreviewUrl: string | null;
  
  // Parameters
  params: BlueprintParams;
  
  // Response data
  lastResponse: GenerateBlueprintV1Response | null;
  
  // UI state
  loading: boolean;
  error: string | null;
  mode: 'fast' | 'final';
  statusMessage: string | null;
  
  // Highlight state
  highlightedColorIndex: number | null;
  
  // Preview quality
  highQualityPreview: boolean; // Toggle for high quality (2048px) vs default (1024px mobile, 2048px desktop)
  
  // Mock mode
  mockMode: boolean; // When true, use mock API instead of real backend
  
  // Cache
  cache: Map<string, GenerateBlueprintV1Response>;
  
  // Per-color DMC cache (keyed by hex string for fast lookups)
  dmcCache: Map<string, {
    ok: boolean;
    best?: any;
    alternatives?: any[];
    method?: string;
  }>;
  
  // Actions
  setImageId: (imageId: string | null) => void;
  setOriginalPreviewUrl: (url: string | null) => void;
  updateParams: (updates: Partial<BlueprintParams>) => void;
  setLastResponse: (response: GenerateBlueprintV1Response | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setMode: (mode: 'fast' | 'final') => void;
  setStatusMessage: (message: string | null) => void;
  setHighlightedColorIndex: (index: number | null) => void;
  setHighQualityPreview: (enabled: boolean) => void;
  setMockMode: (enabled: boolean) => void;
  cacheResponse: (key: string, response: GenerateBlueprintV1Response) => void;
  getCachedResponse: (key: string) => GenerateBlueprintV1Response | undefined;
  cacheDmcMatch: (hex: string, dmcMatch: { ok: boolean; best?: any; alternatives?: any[]; method?: string }) => void;
  getCachedDmcMatch: (hex: string) => { ok: boolean; best?: any; alternatives?: any[]; method?: string } | undefined;
  reset: () => void;
}

const defaultParams: BlueprintParams = {
  paletteSize: 18, // Default optimized for common 15-20 color range
  minRegionArea: 40,
  mergeSmallRegions: true,
  seed: 42,
};

/**
 * Detect if current device is mobile based on screen width
 * Returns true if window.innerWidth < 768px
 */
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

/**
 * Get default high quality preview setting based on device type
 * Mobile: false (defaults to 1024px)
 * Desktop: true (defaults to 2048px)
 * 
 * SSR-safe: Returns false during SSR, will be updated in useEffect on mount
 */
function getDefaultHighQualityPreview(): boolean {
  // SSR-safe default: assume desktop (true) to avoid hydration mismatch
  // Will be corrected in useEffect on client mount
  if (typeof window === 'undefined') return true;
  return !isMobileDevice();
}

/**
 * Get default mock mode from environment variable
 * 
 * PRODUCTION SAFETY: In production (NODE_ENV=production), mock mode MUST default to false
 * regardless of env vars to prevent accidental mock mode in production.
 * 
 * DEVELOPMENT DEFAULT: In development, defaults to true (mock mode) for instant testing
 * without requiring a demo server. Can be overridden with NEXT_PUBLIC_BLUEPRINT_MOCK=0
 * 
 * SSR-safe: Returns false during SSR, will be updated in useEffect on mount
 */
function getDefaultMockMode(): boolean {
  // CRITICAL: Production safety guard - never enable mock mode in production
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
    return false;
  }
  
  // SSR-safe: return false during SSR, will be updated in useEffect on mount
  if (typeof window === 'undefined') return false;
  
  // Development: default to mock mode (true) unless explicitly disabled
  // Allow override with NEXT_PUBLIC_BLUEPRINT_MOCK=0 to disable mock mode
  if (process.env.NEXT_PUBLIC_BLUEPRINT_MOCK === '0') {
    return false;
  }
  
  // Default to mock mode in development for instant testing
  return true;
}

export const useBlueprintStore = create<BlueprintState>((set, get) => ({
  // Initial state
  imageId: null,
  originalPreviewUrl: null,
  params: defaultParams,
  lastResponse: null,
  loading: false,
  error: null,
  mode: 'fast',
  statusMessage: null,
  highlightedColorIndex: null,
  highQualityPreview: getDefaultHighQualityPreview(),
  mockMode: getDefaultMockMode(),
  cache: new Map(),
  dmcCache: new Map(),

  // Actions
  setImageId: (imageId) => set({ imageId }),
  setOriginalPreviewUrl: (url) => set({ originalPreviewUrl: url }),
  updateParams: (updates) => set((state) => {
    const newParams = { ...state.params, ...updates };
    // Clamp paletteSize to valid range [2, 40]
    if (newParams.paletteSize !== undefined) {
      newParams.paletteSize = Math.max(2, Math.min(40, Math.round(newParams.paletteSize)));
    }
    return { params: newParams };
  }),
  setLastResponse: (response) => set({ lastResponse: response }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setMode: (mode) => set({ mode }),
  setStatusMessage: (message) => set({ statusMessage: message }),
  setHighlightedColorIndex: (index) => set({ highlightedColorIndex: index }),
  setHighQualityPreview: (enabled) => set({ highQualityPreview: enabled }),
  setMockMode: (enabled) => {
    // PRODUCTION SAFETY: Never allow enabling mock mode in production
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
      // Silently ignore attempts to enable mock mode in production
      return;
    }
    set({ mockMode: enabled });
  },
  cacheResponse: (key, response) => {
    const cache = get().cache;
    // Limit cache size to 20 entries
    if (cache.size >= 20) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    cache.set(key, response);
    set({ cache: new Map(cache) });
  },
  getCachedResponse: (key) => get().cache.get(key),
  cacheDmcMatch: (hex, dmcMatch) => {
    const dmcCache = get().dmcCache;
    // Limit cache size to 200 entries (enough for many palettes)
    if (dmcCache.size >= 200) {
      const firstKey = dmcCache.keys().next().value;
      dmcCache.delete(firstKey);
    }
    dmcCache.set(hex, dmcMatch);
    set({ dmcCache: new Map(dmcCache) });
  },
  getCachedDmcMatch: (hex) => get().dmcCache.get(hex),
  reset: () => {
    // PRODUCTION SAFETY: Ensure mockMode respects production guard even on reset
    const safeMockMode = (() => {
      if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
        return false;
      }
      return getDefaultMockMode();
    })();
    
    set({
      imageId: null,
      originalPreviewUrl: null,
      params: defaultParams,
      lastResponse: null,
      loading: false,
      error: null,
      mode: 'fast',
      statusMessage: null,
      highlightedColorIndex: null,
      highQualityPreview: getDefaultHighQualityPreview(),
      mockMode: safeMockMode,
      cache: new Map(),
      dmcCache: new Map(),
    });
  },
}));
