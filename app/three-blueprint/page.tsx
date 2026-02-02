/**
 * ThreeJS Live Blueprint page
 */

'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { BlueprintCanvas } from '@/components/three/BlueprintCanvas';
import { BlueprintControls } from '@/components/controls/BlueprintControls';
import { PalettePanel, useHighlightColor } from '@/components/palette/PalettePanel';
import { useBlueprintStore } from '@/store/blueprintStore';
import { registerImage, generateBlueprintV1, getCacheKey, setMockModeEnabled, getDemoOrigin, getDemoOriginDebug, loadDmcMatchesBatch } from '@/lib/api/blueprint';

const DEBOUNCE_MS = 0; // Instant updates - no debouncing
const FINAL_PREVIEW_DELAY_MS = 500; // Reduced delay for final preview
const FAST_MAX_SIZE = 512;
const FINAL_MAX_SIZE_DESKTOP = 2048;
const FINAL_MAX_SIZE_MOBILE = 1024;

export default function ThreeBlueprintPage() {
  const imageId = useBlueprintStore((state) => state.imageId);
  const originalPreviewUrl = useBlueprintStore((state) => state.originalPreviewUrl);
  const params = useBlueprintStore((state) => state.params);
  const lastResponse = useBlueprintStore((state) => state.lastResponse);
  const setImageId = useBlueprintStore((state) => state.setImageId);
  const setOriginalPreviewUrl = useBlueprintStore((state) => state.setOriginalPreviewUrl);
  const setLastResponse = useBlueprintStore((state) => state.setLastResponse);
  const setLoading = useBlueprintStore((state) => state.setLoading);
  const setError = useBlueprintStore((state) => state.setError);
  const setMode = useBlueprintStore((state) => state.setMode);
  const setStatusMessage = useBlueprintStore((state) => state.setStatusMessage);
  const cacheResponse = useBlueprintStore((state) => state.cacheResponse);
  const getCachedResponse = useBlueprintStore((state) => state.getCachedResponse);
  const highQualityPreview = useBlueprintStore((state) => state.highQualityPreview);
  const mockMode = useBlueprintStore((state) => state.mockMode);
  const setMockMode = useBlueprintStore((state) => state.setMockMode);
  const error = useBlueprintStore((state) => state.error);
  const loading = useBlueprintStore((state) => state.loading);
  const statusMessage = useBlueprintStore((state) => state.statusMessage);
  const mode = useBlueprintStore((state) => state.mode);

  // Client-only state to prevent hydration mismatch for mockMode
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sync mock mode to API layer
  // CRITICAL: This ensures UI state and API layer are always synchronized
  // Runs on mount and whenever mockMode changes
  useEffect(() => {
    setMockModeEnabled(mockMode);
  }, [mockMode]);

  // Initialize API layer mock mode on mount (ensures sync even if store initializes before this component)
  useEffect(() => {
    setMockModeEnabled(mockMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  const highlightColor = useHighlightColor();
  const highlightThreshold = 0.15; // RGB distance threshold for highlighting

  // Helper to get final preview maxSize based on toggle and device type
  // SSR-safe: window check prevents hydration mismatch
  const getFinalMaxSize = useCallback(() => {
    // If high quality toggle is ON, always use 2048
    if (highQualityPreview) {
      return FINAL_MAX_SIZE_DESKTOP;
    }
    // Otherwise use device-appropriate default
    // SSR-safe: Only check window on client side
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return FINAL_MAX_SIZE_MOBILE;
    }
    // SSR-safe default: assume desktop during SSR
    return FINAL_MAX_SIZE_DESKTOP;
  }, [highQualityPreview]);

  // Refs for debouncing and cancellation
  // Use separate abort controllers for fast vs final to prevent starvation
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const finalPreviewTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fastAbortControllerRef = useRef<AbortController | null>(null);
  const finalAbortControllerRef = useRef<AbortController | null>(null);
  const fastRequestIdRef = useRef(0);
  const finalRequestIdRef = useRef(0);

  // Auto-load sample image in mock mode
  useEffect(() => {
    if (mockMode && !imageId && !originalPreviewUrl) {
      const sampleImageUrl = '/mock/sample.jpg';
      setOriginalPreviewUrl(sampleImageUrl);

      // Load sample image and register it
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const base64 = canvas.toDataURL('image/jpeg');

            setLoading(true);
            setStatusMessage('Registering image...');

            const registerResult = await registerImage({
              imageBase64: base64,
              maxSize: 1024, // Smaller size for faster registration
            });

            if (registerResult.ok && registerResult.imageId) {
              setImageId(registerResult.imageId);
              setLoading(false);
              setStatusMessage(null);
              // Auto-trigger FAST request at default 18 colors for instant output
              setTimeout(() => {
                triggerPreview(true);
              }, 50);
            } else {
              setError('Failed to register sample image');
              setLoading(false);
              setStatusMessage(null);
            }
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load sample image');
          setLoading(false);
          setStatusMessage(null);
        }
      };
      img.onerror = () => {
        setError('Failed to load sample image');
      };
      img.src = sampleImageUrl;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mockMode]); // Only re-run when mockMode changes

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    // Clean up previous state
    if (fastAbortControllerRef.current) {
      fastAbortControllerRef.current.abort();
      fastAbortControllerRef.current = null;
    }
    if (finalAbortControllerRef.current) {
      finalAbortControllerRef.current.abort();
      finalAbortControllerRef.current = null;
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (finalPreviewTimerRef.current) {
      clearTimeout(finalPreviewTimerRef.current);
      finalPreviewTimerRef.current = null;
    }

    // OBJECT URL SAFETY: Revoke previous blob URL before creating new one
    const previousUrl = originalPreviewUrl;
    if (previousUrl && previousUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previousUrl);
    }

    setError(null);
    setLastResponse(null);
    setImageId(null);
    setOriginalPreviewUrl(null);

    // Create object URL for immediate preview
    // This will be cleaned up by the useEffect cleanup when originalPreviewUrl changes
    const objectUrl = URL.createObjectURL(file);
    setOriginalPreviewUrl(objectUrl);

    // Read file as base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      if (!base64) return;

      try {
        setLoading(true);
        setStatusMessage('Registering image...');

        // Register image (use smaller size for faster registration)
        // We'll resize again during blueprint generation anyway
        const registerResult = await registerImage({
          imageBase64: base64,
          maxSize: 1024, // Smaller size for faster registration
        }).catch((err) => {
          // Provide helpful error message
          if (err.message.includes('timeout') || err.message.includes('Cannot reach')) {
            throw new Error(
              `Cannot connect to demo server. ` +
              `Please run: npm run demo (in a separate terminal), ` +
              `or enable Mock Mode in Advanced Options for faster testing.`
            );
          }
          throw err;
        });

        if (!registerResult.ok || !registerResult.imageId) {
          throw new Error(registerResult.error || 'Failed to register image');
        }

        setImageId(registerResult.imageId);
        setLoading(false);
        setStatusMessage(null);

        // Auto-trigger FAST request at default 18 colors for instant output
        // Small delay to ensure state is updated
        setTimeout(() => {
          triggerPreview(true);
        }, 50);
      } catch (err) {
        // OBJECT URL SAFETY: Revoke object URL on error
        if (objectUrl && objectUrl.startsWith('blob:')) {
          URL.revokeObjectURL(objectUrl);
        }
        setError(err instanceof Error ? err.message : 'Failed to register image');
        setLoading(false);
        setStatusMessage(null);
      }
    };
    reader.readAsDataURL(file);
  }, [setImageId, setOriginalPreviewUrl, setError, setLoading, setStatusMessage, setLastResponse, originalPreviewUrl]);

  // Generate preview with caching and cancellation
  // Uses separate abort controllers for fast vs final to prevent starvation
  const generatePreview = useCallback(
    async (maxSize: number, mode: 'fast' | 'final', isInitial: boolean) => {
      if (!imageId) return;

      // Check cache first
      const cacheKey = getCacheKey(
        {
          imageId,
          paletteSize: params.paletteSize,
          maxSize,
          seed: params.seed,
          simplification: params.simplification,
          smoothing: params.smoothing,
          minRegionSize: params.minRegionSize,
          toneWeight: params.toneWeight,
          returnPreview: true,
        },
        mode
      );

      const cached = getCachedResponse(cacheKey);
      if (cached) {
        // Populate missing DMC matches from per-color cache
        const getCachedDmcMatch = useBlueprintStore.getState().getCachedDmcMatch;
        if (cached.palette) {
          const updatedPalette = cached.palette.map((color) => {
            // If DMC match is missing, try to get from cache
            if (!color.dmcMatch?.ok && color.dmcMatch?.ok !== false) {
              const cachedDmc = getCachedDmcMatch(color.hex);
              if (cachedDmc) {
                return { ...color, dmcMatch: cachedDmc };
              }
            }
            return color;
          });
          setLastResponse({ ...cached, palette: updatedPalette });
        } else {
          setLastResponse(cached);
        }
        setLoading(false);
        setStatusMessage(null);
        return;
      }

      // Use separate abort controllers for fast vs final
      // Fast requests can abort other fast requests, but NOT final requests
      // Final requests can abort other final requests, but NOT fast requests
      const abortControllerRef = mode === 'fast' ? fastAbortControllerRef : finalAbortControllerRef;
      const requestIdRef = mode === 'fast' ? fastRequestIdRef : finalRequestIdRef;

      // Abort previous request of the same type only
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller and request ID
      abortControllerRef.current = new AbortController();
      const currentRequestId = ++requestIdRef.current;

      setMode(mode);
      setLoading(true);
      setStatusMessage(mode === 'fast' ? 'Fast preview...' : 'Final preview...');
      setError(null);

      try {
        // For fast requests, skip DMC matching to improve speed
        const isFast = mode === 'fast';
        const response = await generateBlueprintV1(
          {
            imageId,
            paletteSize: params.paletteSize,
            maxSize,
            seed: params.seed,
            returnPreview: true,
            simplification: params.simplification,
            smoothing: params.smoothing,
            minRegionSize: params.minRegionSize,
            toneWeight: params.toneWeight,
            includeDmc: !isFast, // Skip DMC for fast requests
          },
          abortControllerRef.current.signal,
          originalPreviewUrl || undefined
        );

        // Check if response is stale (for this request type)
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        if (!response.ok) {
          // Handle session timeout / server restart gracefully
          if (response.error?.includes('Register the image first')) {
            setImageId(null); // Clear invalid ID to force fresh start
            throw new Error('Server session restarted. Please re-upload your image to continue.');
          }
          throw new Error(response.error || 'Failed to generate blueprint');
        }

        // Cache DMC matches from response (if included)
        const cacheDmcMatch = useBlueprintStore.getState().cacheDmcMatch;
        if (response.palette) {
          response.palette.forEach((color) => {
            if (color.dmcMatch?.ok && color.dmcMatch.best) {
              cacheDmcMatch(color.hex, color.dmcMatch);
            }
          });
        }

        // Cache and update state
        cacheResponse(cacheKey, response);
        setLastResponse(response);
        setLoading(false);
        setStatusMessage(null);

        // If this was a fast request without DMC matches, load them progressively
        if (mode === 'fast' && response.palette && response.palette.some(c => !c.dmcMatch?.ok)) {
          // Load DMC matches progressively with per-color caching
          const getCachedDmcMatch = useBlueprintStore.getState().getCachedDmcMatch;

          // Check cache first, only load missing matches
          const colorsToMatch: Array<{ r: number; g: number; b: number; hex: string; index: number }> = [];
          response.palette!.forEach((color, index) => {
            const cached = getCachedDmcMatch(color.hex);
            if (cached) {
              // Use cached match immediately
              const updatedPalette = [...response.palette!];
              updatedPalette[index] = {
                ...color,
                dmcMatch: cached,
              };
              setLastResponse({ ...response, palette: updatedPalette });
            } else {
              colorsToMatch.push({ r: color.rgb[0], g: color.rgb[1], b: color.rgb[2], hex: color.hex, index });
            }
          });

          // Only load matches for colors not in cache
          if (colorsToMatch.length > 0) {
            loadDmcMatchesBatch(
              colorsToMatch.map(c => ({ r: c.r, g: c.g, b: c.b })),
              abortControllerRef.current.signal
            ).then((dmcMatches) => {
              // Check if response is still current
              if (currentRequestId !== requestIdRef.current) {
                return;
              }

              // Update palette with DMC matches and cache them
              const updatedPalette = [...(response.palette || [])];
              colorsToMatch.forEach((colorInfo, matchIndex) => {
                const match = dmcMatches[matchIndex];
                const dmcMatch = {
                  ok: match?.ok || false,
                  best: match?.best,
                  alternatives: match?.alternatives || [],
                  method: match?.method || 'lab-d65-deltae76',
                };
                // Cache the match
                cacheDmcMatch(colorInfo.hex, dmcMatch);
                // Update palette
                updatedPalette[colorInfo.index] = {
                  ...updatedPalette[colorInfo.index],
                  dmcMatch,
                };
              });

              // Update response with DMC matches
              const updatedResponse = {
                ...response,
                palette: updatedPalette,
              };

              setLastResponse(updatedResponse);
            }).catch((err) => {
              // Ignore errors for progressive loading (non-critical)
              if (err.name !== 'AbortError') {
                console.warn('Failed to load DMC matches:', err);
              }
            });
          }
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        // Check if error is stale (for this request type)
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        setError(err instanceof Error ? err.message : 'An error occurred');
        setLoading(false);
        setStatusMessage(null);
      }
    },
    [
      imageId,
      params,
      setMode,
      setLoading,
      setStatusMessage,
      setError,
      setLastResponse,
      cacheResponse,
      getCachedResponse,
    ]
  );

  // Trigger preview instantly (no debouncing for immediate feedback)
  const triggerPreview = useCallback(
    (isInitial: boolean) => {
      if (!imageId) return;

      // Clear existing timers
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (finalPreviewTimerRef.current) {
        clearTimeout(finalPreviewTimerRef.current);
      }

      // Instant fast preview - no debounce delay
      generatePreview(FAST_MAX_SIZE, 'fast', isInitial);

      // After a short delay, generate final preview with device-appropriate maxSize
      finalPreviewTimerRef.current = setTimeout(() => {
        const finalMaxSize = getFinalMaxSize();
        generatePreview(finalMaxSize, 'final', false);
      }, FINAL_PREVIEW_DELAY_MS);
    },
    [imageId, generatePreview, getFinalMaxSize]
  );

  // Load sample image
  const loadSampleImage = useCallback(async () => {
    const sampleImageUrl = '/mock/sample.jpg';

    // Clean up previous state
    if (fastAbortControllerRef.current) {
      fastAbortControllerRef.current.abort();
      fastAbortControllerRef.current = null;
    }
    if (finalAbortControllerRef.current) {
      finalAbortControllerRef.current.abort();
      finalAbortControllerRef.current = null;
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (finalPreviewTimerRef.current) {
      clearTimeout(finalPreviewTimerRef.current);
      finalPreviewTimerRef.current = null;
    }

    // OBJECT URL SAFETY: Revoke previous blob URL before creating new one
    const previousUrl = originalPreviewUrl;
    if (previousUrl && previousUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previousUrl);
    }

    setError(null);
    setLastResponse(null);
    setImageId(null);
    setOriginalPreviewUrl(sampleImageUrl);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }
        ctx.drawImage(img, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg');

        setLoading(true);
        setStatusMessage('Registering image...');

        const registerResult = await registerImage({
          imageBase64: base64,
          maxSize: 1024,
        }).catch((err) => {
          throw err;
        });

        if (!registerResult.ok || !registerResult.imageId) {
          throw new Error(registerResult.error || 'Failed to register sample image');
        }

        setImageId(registerResult.imageId);
        setLoading(false);
        setStatusMessage(null);

        // Auto-trigger FAST request at default 18 colors for instant output
        setTimeout(() => {
          triggerPreview(true);
        }, 50);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sample image');
        setLoading(false);
        setStatusMessage(null);
      }
    };
    img.onerror = () => {
      setError('Failed to load sample image');
      setLoading(false);
      setStatusMessage(null);
    };
    img.src = sampleImageUrl;
  }, [setImageId, setOriginalPreviewUrl, setError, setLoading, setStatusMessage, setLastResponse, originalPreviewUrl, triggerPreview]);

  // Trigger preview when params change
  useEffect(() => {
    if (imageId) {
      triggerPreview(false);
    }
  }, [imageId, params.paletteSize, params.simplification, params.smoothing, params.minRegionSize, params.toneWeight, triggerPreview]);

  // Cleanup on unmount and when originalPreviewUrl changes
  // OBJECT URL SAFETY: Always revoke blob URLs to prevent memory leaks
  // Public asset URLs (starting with '/') must NOT be revoked
  useEffect(() => {
    // Store previous URL for cleanup
    const previousUrl = originalPreviewUrl;

    return () => {
      // Cleanup abort controllers
      if (fastAbortControllerRef.current) {
        fastAbortControllerRef.current.abort();
      }
      if (finalAbortControllerRef.current) {
        finalAbortControllerRef.current.abort();
      }

      // Cleanup timers
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (finalPreviewTimerRef.current) {
        clearTimeout(finalPreviewTimerRef.current);
      }

      // OBJECT URL SAFETY: Revoke blob URLs to prevent memory leaks
      // Only revoke object URLs (blob:), never public asset URLs (/, /mock/, etc.)
      if (previousUrl && previousUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previousUrl);
      }
    };
  }, [originalPreviewUrl]);

  const previewBase64 = lastResponse?.indexedPreviewPngBase64 || null;

  const palette = lastResponse?.palette || [];
  const totalThreads = palette.filter(c => c.dmcMatch?.ok && c.dmcMatch.best).length;
  const hasDmcData = palette.some(c => c.dmcMatch?.ok && c.dmcMatch.best);

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] paper-texture selection:bg-[var(--accent)] selection:text-[var(--paper)]">
      {/* Top Hairline */}
      <div className="hairline-b bg-[var(--paper-2)]/50 sticky top-0 z-50 backdrop-blur-sm">
        <div className="container mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-serif font-medium tracking-tight">Magpie Embroidery</h1>
            <div className="h-4 w-[1px] bg-[var(--border)]" />
            <p className="text-[10px] text-[var(--muted)] font-sans uppercase tracking-[0.2em] mt-0.5">Blueprint Specimen 01</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Status Indicators */}
            <div className="flex items-center gap-2">
              {isMounted && (
                <div className={`px-2 py-0.5 rounded-none text-[9px] font-sans font-bold uppercase tracking-widest border ${mockMode ? 'border-amber-500 text-amber-600 bg-amber-50/50' : 'border-[var(--muted)] text-[var(--muted)]'
                  }`}>
                  {mockMode ? 'Mock' : 'Live'}
                </div>
              )}
              {imageId && (
                <div className={`px-2 py-0.5 rounded-none text-[9px] font-sans font-bold uppercase tracking-widest border ${loading ? 'border-blue-500 text-blue-600 animate-pulse' : 'border-green-600 text-green-700 bg-green-50/50'
                  }`}>
                  {loading ? (mode === 'fast' ? 'Sync' : 'Finalizing') : 'Ready'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6 max-w-7xl pt-10">
        {/* App Meta Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 items-baseline">
          <div className="col-span-1">
            <h2 className="text-xs font-sans font-bold uppercase tracking-[0.15em] text-[var(--muted)] mb-3">Project Metadata</h2>
            <div className="space-y-1.5">
              <div className="flex justify-between hairline-b pb-1.5">
                <span className="text-[10px] font-sans text-[var(--muted)] uppercase tracking-wider">Indexed Colors</span>
                <span className="text-xs font-sans font-medium">{palette.length || params.paletteSize}</span>
              </div>
              {hasDmcData && (
                <div className="flex justify-between hairline-b pb-1.5">
                  <span className="text-[10px] font-sans text-[var(--muted)] uppercase tracking-wider">Thread Manifest</span>
                  <span className="text-xs font-sans font-medium">{totalThreads} Units</span>
                </div>
              )}
              <div className="flex justify-between hairline-b pb-1.5">
                <span className="text-[10px] font-sans text-[var(--muted)] uppercase tracking-wider">Engine Status</span>
                <span className="text-xs font-sans font-medium uppercase tracking-tighter">Optimized-R2</span>
              </div>
            </div>
          </div>
          <div className="col-span-1 md:col-span-2">
            {isMounted && !mockMode && (
              <div className="h-full flex flex-col justify-end">
                <span className="text-[9px] text-[var(--muted)] font-mono opacity-40 uppercase tracking-widest">
                  Endpoint: {getDemoOrigin()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Error with switch to mock mode button */}
        {isMounted && error && !mockMode && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-red-800 font-sans font-semibold mb-1">API Connection Error</p>
                <p className="text-red-700 text-sm font-sans">{error}</p>
              </div>
              <button
                onClick={() => {
                  setMockMode(true);
                  setError(null);
                }}
                className="ml-4 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--ink)] text-[var(--paper)] font-sans font-medium rounded transition-colors whitespace-nowrap text-sm"
              >
                Switch to Mock Mode
              </button>
            </div>
          </div>
        )}

        {/* File upload / Image selection */}
        <div className="mb-6">
          <FileUpload
            onFileSelect={handleFileUpload}
            onLoadSample={loadSampleImage}
            hasImage={!!imageId}
          />
        </div>

        {/* Primary Control: Colors Used slider */}
        {imageId && (
          <div className="mb-6">
            <ColorsUsedControl />
          </div>
        )}

        {/* Main layout - Desktop: Output + Thread List side by side, Mobile: stacked */}
        {imageId ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
            {/* Desktop: Blueprint Output (75%) + Thread List (25%) */}
            {/* Mobile: Blueprint Output full width, then Thread List full width */}
            <div className="lg:col-span-9 order-1">
              <BlueprintOutputPanel
                previewBase64={previewBase64}
                highlightColor={highlightColor}
                highlightThreshold={highlightThreshold}
                loading={loading}
                statusMessage={statusMessage}
                mode={mode}
              />
            </div>
            <div className="lg:col-span-3 order-2">
              <PalettePanel />
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <BlueprintOutputPanel
              previewBase64={previewBase64}
              highlightColor={highlightColor}
              highlightThreshold={highlightThreshold}
              loading={loading}
              statusMessage={statusMessage}
              mode={mode}
            />
          </div>
        )}

        {/* Reference Image - Collapsible, secondary */}
        {imageId && (
          <div className="mb-4">
            <ReferenceImagePanel originalPreviewUrl={originalPreviewUrl} highlightThreshold={highlightThreshold} />
          </div>
        )}

        {/* Controls - Advanced options in accordion */}
        <div className="mb-4">
          <BlueprintControls />
        </div>
      </div>
    </div>
  );
}

interface ColorsUsedControlProps { }

function ColorsUsedControl({ }: ColorsUsedControlProps) {
  const params = useBlueprintStore((state) => state.params);
  const updateParams = useBlueprintStore((state) => state.updateParams);

  return (
    <div className="p-8 bg-[var(--paper-2)] border border-[var(--border)] relative overflow-hidden">
      <div className="absolute top-0 right-0 p-2 opacity-5">
        <span className="text-4xl font-serif font-bold italic select-none">Quantity</span>
      </div>
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <label className="block text-[10px] font-sans font-bold text-[var(--muted)] uppercase tracking-[0.2em] mb-1">
            Complexity Gradient
          </label>
          <p className="text-[11px] text-[var(--muted)] font-sans italic">
            Adjusting color density for optimal stitch resolution
          </p>
        </div>
        <span className="text-4xl font-serif font-medium tracking-tighter tabular-nums underline decoration-[0.5px] underline-offset-8 decoration-[var(--border)]">
          {params.paletteSize}
        </span>
      </div>
      <div className="relative h-12 flex items-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full h-[1px] bg-[var(--border)]" />
        </div>
        <input
          type="range"
          min="2"
          max="40"
          value={params.paletteSize}
          onChange={(e) => {
            const value = parseInt(e.target.value, 10);
            const clampedValue = Math.max(2, Math.min(40, value));
            if (!isNaN(clampedValue)) {
              updateParams({ paletteSize: clampedValue });
            }
          }}
          className="relative w-full h-8 bg-transparent appearance-none cursor-pointer z-10 transition-all active:scale-[0.99]"
          style={{
            WebkitAppearance: 'none',
            outline: 'none',
          }}
        />
        {/* Custom thumb style via global CSS or inline if needed, but for now standard range with custom track background is fine */}
        <style jsx>{`
          input[type='range']::-webkit-slider-thumb {
            -webkit-appearance: none;
            height: 24px;
            width: 1px;
            background: var(--accent);
            cursor: pointer;
            box-shadow: 0 0 0 6px var(--paper), 0 0 0 7px var(--border);
          }
          input[type='range']::-moz-range-thumb {
            height: 24px;
            width: 1px;
            background: var(--accent);
            cursor: pointer;
            border: none;
            border-radius: 0;
            box-shadow: 0 0 0 6px var(--paper), 0 0 0 7px var(--border);
          }
        `}</style>
      </div>
      <div className="flex justify-between mt-4">
        <span className="text-[9px] font-sans text-[var(--muted)] uppercase tracking-widest">Min (02)</span>
        <span className="text-[9px] font-sans text-[var(--muted)] uppercase tracking-widest text-right">Max (40)</span>
      </div>
    </div>
  );
}

interface BlueprintOutputPanelProps {
  previewBase64: string | null;
  highlightColor: [number, number, number] | null;
  highlightThreshold: number;
  loading: boolean;
  statusMessage: string | null;
  mode: 'fast' | 'final';
}

function BlueprintOutputPanel({
  previewBase64,
  highlightColor,
  highlightThreshold,
  loading,
  statusMessage,
  mode
}: BlueprintOutputPanelProps) {
  const [viewMode, setViewMode] = React.useState<'fit' | '1:1'>('fit');

  return (
    <div className="h-[700px] lg:h-[900px] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h3 className="text-[10px] font-sans font-bold text-[var(--muted)] uppercase tracking-[0.2em]">
            Production View
          </h3>
          <div className="px-2 py-0.5 border border-[var(--border)] text-[8px] font-mono text-[var(--muted)] uppercase tracking-tighter">
            VIEW_MODE_{viewMode.toUpperCase()}
          </div>
        </div>
        <div className="flex items-center gap-[1px] bg-[var(--border)] p-[1px]">
          <button
            onClick={() => setViewMode('fit')}
            className={`px-4 py-1.5 text-[10px] font-sans uppercase tracking-widest transition-colors ${viewMode === 'fit'
              ? 'bg-[var(--accent)] text-[var(--paper)]'
              : 'bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
          >
            [ fit ]
          </button>
          <button
            onClick={() => setViewMode('1:1')}
            className={`px-4 py-1.5 text-[10px] font-sans uppercase tracking-widest transition-colors ${viewMode === '1:1'
              ? 'bg-[var(--accent)] text-[var(--paper)]'
              : 'bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
          >
            [ 1:1 ]
          </button>
        </div>
      </div>
      <div className="flex-1 bg-white border border-[var(--border)] relative overflow-hidden group">
        <div className="absolute top-2 left-2 z-10 pointer-events-none opacity-20 transition-opacity group-hover:opacity-40">
          <div className="w-12 h-12 border-t border-l border-[var(--ink)]" />
        </div>
        <div className="absolute bottom-2 right-2 z-10 pointer-events-none opacity-20 transition-opacity group-hover:opacity-40">
          <div className="w-12 h-12 border-b border-r border-[var(--ink)]" />
        </div>

        <BlueprintCanvas
          previewBase64={previewBase64}
          originalImageUrl={null}
          highlightColor={highlightColor}
          highlightThreshold={highlightThreshold}
          viewMode={viewMode}
        />
        {loading && (
          <div className="absolute inset-0 bg-[var(--paper)]/60 backdrop-blur-[2px] flex flex-col items-center justify-center z-20">
            <div className="w-24 h-[1px] bg-[var(--border)] mb-4 overflow-hidden">
              <div className="w-full h-full bg-[var(--accent)] -translate-x-full animate-[loading_1.5s_infinite_ease-in-out]" />
            </div>
            <div className="text-[10px] text-[var(--accent)] font-sans font-bold uppercase tracking-[0.2em]">{statusMessage || 'Processing...'}</div>
          </div>
        )}
        <style jsx>{`
          @keyframes loading {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(0%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    </div>
  );
}

interface ReferenceImagePanelProps {
  originalPreviewUrl: string | null;
  highlightThreshold: number;
}

function ReferenceImagePanel({ originalPreviewUrl, highlightThreshold }: ReferenceImagePanelProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(true);
  const [viewMode, setViewMode] = React.useState<'fit' | '1:1'>('fit');

  if (!originalPreviewUrl) return null;

  return (
    <div className="bg-[var(--paper-2)] border border-[var(--border)] overflow-hidden">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-[var(--accent-light)] transition-colors"
      >
        <div className="flex items-center gap-4">
          <h3 className="text-[10px] font-sans font-bold text-[var(--muted)] uppercase tracking-[0.2em]">
            Reference Plate
          </h3>
          <span className="text-[9px] font-sans text-[var(--muted)] opacity-50 font-mono">
            REF_SOURCE_01
          </span>
        </div>
        <span className="text-[10px] text-[var(--muted)] font-mono">{isCollapsed ? '[ + ]' : '[ — ]'}</span>
      </button>
      {!isCollapsed && (
        <div className="h-[500px] p-6 pt-0">
          <div className="flex items-center justify-between mb-4 mt-2">
            <span className="text-[10px] font-sans text-[var(--muted)] italic">Original chromatic data for comparison</span>
            <div className="flex items-center gap-[1px] bg-[var(--border)] p-[1px]">
              <button
                onClick={() => setViewMode('fit')}
                className={`px-4 py-1.5 text-[10px] font-sans uppercase tracking-widest transition-colors ${viewMode === 'fit'
                  ? 'bg-[var(--accent)] text-[var(--paper)]'
                  : 'bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
              >
                Fit
              </button>
              <button
                onClick={() => setViewMode('1:1')}
                className={`px-4 py-1.5 text-[10px] font-sans uppercase tracking-widest transition-colors ${viewMode === '1:1'
                  ? 'bg-[var(--accent)] text-[var(--paper)]'
                  : 'bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
              >
                1:1
              </button>
            </div>
          </div>
          <div className="h-full bg-white border border-[var(--border)] relative overflow-hidden">
            <div
              className="w-full h-full"
              style={{
                transform: viewMode === '1:1' ? 'scale(2)' : 'scale(1)',
                transformOrigin: 'center center',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <BlueprintCanvas
                previewBase64={null}
                originalImageUrl={originalPreviewUrl}
                highlightColor={null}
                highlightThreshold={highlightThreshold}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onLoadSample?: () => void;
  hasImage?: boolean;
}

function FileUpload({ onFileSelect, onLoadSample, hasImage = false }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onFileSelect(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      onFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <div
        className="border border-[var(--border)] p-12 text-center hover:bg-[var(--accent-light)]/30 transition-all cursor-pointer relative overflow-hidden group"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={handleUploadClick}
      >
        <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-[var(--muted)] opacity-20" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-[var(--muted)] opacity-20" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-[var(--muted)] opacity-20" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-[var(--muted)] opacity-20" />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-6 py-4">
          <div>
            <span className="text-[10px] font-sans font-bold text-[var(--muted)] uppercase tracking-[0.3em] block mb-2">
              Source Selection
            </span>
            <p className="text-xl font-serif text-[var(--ink)]">
              {hasImage ? 'Replace current specimen' : 'Select an image for analysis'}
            </p>
          </div>

          <div className="flex items-center gap-6">
            <button
              className="px-8 py-3 bg-[var(--accent)] text-[var(--paper)] font-sans font-bold uppercase tracking-widest text-[10px] transition-transform group-hover:scale-105"
            >
              Initialize Upload
            </button>
            {onLoadSample && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onLoadSample();
                }}
                className="text-[10px] font-sans font-bold text-[var(--muted)] hover:text-[var(--ink)] uppercase tracking-widest underline underline-offset-4 decoration-[0.5px]"
              >
                Use Factory Sample
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
