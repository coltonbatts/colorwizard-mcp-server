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
  
  // Cache
  cache: Map<string, GenerateBlueprintV1Response>;
  
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
  cacheResponse: (key: string, response: GenerateBlueprintV1Response) => void;
  getCachedResponse: (key: string) => GenerateBlueprintV1Response | undefined;
  reset: () => void;
}

const defaultParams: BlueprintParams = {
  paletteSize: 12,
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
 */
function getDefaultHighQualityPreview(): boolean {
  return !isMobileDevice();
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
  cache: new Map(),

  // Actions
  setImageId: (imageId) => set({ imageId }),
  setOriginalPreviewUrl: (url) => set({ originalPreviewUrl: url }),
  updateParams: (updates) => set((state) => ({
    params: { ...state.params, ...updates },
  })),
  setLastResponse: (response) => set({ lastResponse: response }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setMode: (mode) => set({ mode }),
  setStatusMessage: (message) => set({ statusMessage: message }),
  setHighlightedColorIndex: (index) => set({ highlightedColorIndex: index }),
  setHighQualityPreview: (enabled) => set({ highQualityPreview: enabled }),
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
  reset: () => set({
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
    cache: new Map(),
  }),
}));
