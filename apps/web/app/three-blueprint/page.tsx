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
      originalPreviewUrl,
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
  }, [setImageId, setOriginalPreviewUrl, setError, setLoading, setStatusMessage, setLastResponse, originalPreviewUrl, triggerPreview]);

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
    <div className="min-h-screen relative" style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/5 border-b border-white/10 relative overflow-hidden">
        <div className="container mx-auto px-6 lg:px-8 py-8 flex flex-col items-center justify-center gap-4 relative z-10">
          {/* Main Title */}
          <h1 className="text-4xl lg:text-5xl font-serif font-normal text-center text-[var(--text-primary)] tracking-tight">
            Magpie Embroidery
          </h1>

          {/* Subtitle */}
          <p className="text-sm text-[var(--text-secondary)] tracking-[0.2em] uppercase">Pattern Designer</p>

          {/* Status Indicators */}
          {(imageId && (loading || !loading)) && (
            <div className="flex items-center gap-3 mt-2">
              {loading && (
                <div className="flex items-center gap-2 px-5 py-2 bg-white/5 backdrop-blur-sm rounded-full border border-[var(--pastel-purple)]/20">
                  <div className="w-1.5 h-1.5 bg-[var(--pastel-purple)] rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    {mode === 'fast' ? 'Processing' : 'Finalizing'}
                  </span>
                </div>
              )}
              {!loading && (
                <div className="flex items-center gap-2 px-5 py-2 bg-white/5 backdrop-blur-sm rounded-full border border-[var(--pastel-cyan)]/20">
                  <div className="w-1.5 h-1.5 bg-[var(--pastel-cyan)] rounded-full"></div>
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Ready</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto p-6 lg:p-8 max-w-7xl pt-12 lg:pt-16">
        {/* Project Stats - Only show when image is loaded */}
        {imageId && (
          <div style={{ marginBottom: '100px' }}>
            <div className="flex flex-col sm:flex-row items-center justify-center" style={{ gap: '60px' }}>
              <div className="glass-card rounded-2xl px-16 py-10 border-2 border-white/30 hover:border-[var(--pastel-purple)]/40 transition-all text-center min-w-[180px]">
                <div className="text-[10px] text-[var(--text-secondary)] mb-3 uppercase tracking-widest font-bold">Colors</div>
                <div className="text-5xl font-light text-[var(--text-primary)] tabular-nums">{palette.length || params.paletteSize}</div>
              </div>
              {hasDmcData && (
                <div className="glass-card rounded-2xl px-16 py-10 border-2 border-white/30 hover:border-[var(--pastel-cyan)]/40 transition-all text-center min-w-[180px]">
                  <div className="text-[10px] text-[var(--text-secondary)] mb-3 uppercase tracking-widest font-bold">Thread Colors</div>
                  <div className="text-5xl font-light text-[var(--text-primary)] tabular-nums">{totalThreads}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error with switch to mock mode button */}
        {isMounted && error && !mockMode && (
          <div className="mb-16 p-8 glass-card rounded-xl border border-[var(--warning)]/20 relative overflow-hidden">
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-start gap-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 glass-card rounded-lg flex items-center justify-center border border-[var(--warning)]/20">
                  <svg className="w-6 h-6 text-[var(--warning)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-serif font-normal text-[var(--text-primary)] mb-3">Connection Problem</h3>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-6">{error}</p>
                <button
                  onClick={() => {
                    setMockMode(true);
                    setError(null);
                  }}
                  className="px-6 py-3 bg-[var(--pastel-purple)] hover:bg-[var(--pastel-purple)]/80 text-white font-medium text-sm rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-[var(--pastel-purple)]/30 focus:ring-offset-2 focus:ring-offset-[var(--bg-dark)]"
                >
                  Try Demo Mode
                </button>
              </div>
            </div>
          </div>
        )}

        {/* File upload / Image selection */}
        <div style={{ marginBottom: '120px' }}>
          <FileUpload
            onFileSelect={handleFileUpload}
            onLoadSample={loadSampleImage}
            hasImage={!!imageId}
          />
        </div>

        {/* Primary Control: Colors Used slider */}
        {imageId && (
          <div style={{ marginBottom: '120px' }}>
            <ColorsUsedControl />
          </div>
        )}

        {/* Main layout - Desktop: Output + Thread List side by side, Mobile: stacked */}
        {imageId ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" style={{ marginBottom: '120px' }}>
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
          <div style={{ marginBottom: '120px' }}>
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
          <div style={{ marginBottom: '120px' }}>
            <ReferenceImagePanel originalPreviewUrl={originalPreviewUrl} highlightThreshold={highlightThreshold} />
          </div>
        )}

        {/* Controls - Advanced options in accordion */}
        <div style={{ marginBottom: '120px' }}>
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
    <div className="p-16 lg:p-20 glass-card rounded-2xl border-2 border-white/30">
      <div className="text-center">
        {/* Title */}
        <div className="mb-10">
          <label className="text-2xl font-serif font-normal text-[var(--text-primary)] block mb-4">
            Number of Colors
          </label>
          <p className="text-sm text-[var(--text-muted)]">
            Choose how many thread colors to use in your pattern.
          </p>
        </div>
        
        {/* Big number */}
        <div className="my-12">
          <span className="text-7xl font-light text-[var(--text-primary)] tabular-nums">
            {params.paletteSize}
          </span>
        </div>

        {/* Slider with visible track */}
        <div className="py-6 mb-4">
          <div className="relative h-6">
            {/* Background track */}
            <div className="absolute inset-0 h-6 bg-white/30 rounded-full border border-white/40"></div>
            {/* Filled track */}
            <div 
              className="absolute inset-0 h-6 bg-[var(--pastel-purple)] rounded-full transition-all border border-[var(--pastel-purple)]"
              style={{
                width: `${((params.paletteSize - 2) / 38) * 100}%`
              }}
            ></div>
            {/* Slider input */}
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
              className="relative w-full h-6 bg-transparent appearance-none cursor-pointer focus:outline-none focus:ring-4 focus:ring-[var(--pastel-purple)]/50 z-10 rounded-full"
            />
          </div>
        </div>
        <div className="flex justify-between w-full px-2 mt-6">
          <span className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider">2</span>
          <span className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider">40</span>
        </div>
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h3 className="text-xl font-serif font-normal text-[var(--text-primary)]">
          Your Pattern
        </h3>
        <div className="flex items-center gap-1 glass-card rounded-lg p-1">
          <button
            onClick={() => setViewMode('fit')}
            className={`px-5 py-2 text-xs font-medium uppercase tracking-wider rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-[var(--pastel-purple)]/30 ${viewMode === 'fit'
              ? 'bg-white/10 text-[var(--text-primary)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5'
              }`}
          >
            Fit
          </button>
          <button
            onClick={() => setViewMode('1:1')}
            className={`px-5 py-2 text-xs font-medium uppercase tracking-wider rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-[var(--pastel-purple)]/30 ${viewMode === '1:1'
              ? 'bg-white/10 text-[var(--text-primary)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5'
              }`}
          >
            1:1
          </button>
        </div>
      </div>
      <div className="flex-1 glass-card rounded-xl border border-white/10 relative overflow-hidden">
        <BlueprintCanvas
          previewBase64={previewBase64}
          originalImageUrl={null}
          highlightColor={highlightColor}
          highlightThreshold={highlightThreshold}
          viewMode={viewMode}
        />
        {loading && (
          <div className="absolute inset-0 backdrop-blur-xl bg-[var(--bg-dark)]/90 flex flex-col items-center justify-center z-20">
            <div className="w-12 h-12 mb-4 relative">
              <div className="absolute inset-0 rounded-full border-2 border-white/10"></div>
              <div className="absolute inset-0 rounded-full border-2 border-t-[var(--pastel-purple)] animate-spin"></div>
            </div>
            <div className="text-sm text-[var(--text-secondary)] font-medium">{statusMessage || 'Creating your pattern'}</div>
          </div>
        )}
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
    <div className="glass-card rounded-xl overflow-hidden">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--pastel-purple)]/30"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-serif font-normal text-[var(--text-primary)]">
            Original Image
          </h3>
          <span className="hidden sm:inline px-3 py-1 glass-card rounded-md text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">
            Reference
          </span>
        </div>
        <svg 
          className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {!isCollapsed && (
        <div className="h-[500px] p-6 pt-0">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-[var(--text-muted)]">Compare with your original</span>
            <div className="flex items-center gap-1 glass-card rounded-lg p-1">
              <button
                onClick={() => setViewMode('fit')}
                className={`px-5 py-2 text-xs font-medium uppercase tracking-wider rounded-md transition-all focus:outline-none ${viewMode === 'fit'
                  ? 'bg-white/10 text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
              >
                Fit
              </button>
              <button
                onClick={() => setViewMode('1:1')}
                className={`px-5 py-2 text-xs font-medium uppercase tracking-wider rounded-md transition-all focus:outline-none ${viewMode === '1:1'
                  ? 'bg-white/10 text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
              >
                1:1
              </button>
            </div>
          </div>
          <div className="h-full glass-card rounded-xl relative overflow-hidden border border-white/10">
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
        className="glass-card border-2 border-dashed border-white/10 rounded-xl p-16 lg:p-20 text-center hover:border-[var(--pastel-purple)]/30 transition-all duration-300 cursor-pointer relative overflow-hidden group"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={handleUploadClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="hidden"
        />
        <div className="relative z-10 flex flex-col items-center gap-8 py-4">
          {/* Upload Icon */}
          <div className="w-20 h-20 glass-card rounded-xl flex items-center justify-center transition-all duration-300">
            <svg className="w-10 h-10 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>

          <div className="space-y-3">
            <h3 className="text-2xl lg:text-3xl font-serif font-normal text-[var(--text-primary)]">
              {hasImage ? 'Upload a new image' : 'Upload your image'}
            </h3>
            <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
              Drag and drop your image here, or click to browse.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              className="px-8 py-3 bg-[var(--pastel-purple)] hover:bg-[var(--pastel-purple)]/80 text-white font-medium text-sm rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--pastel-purple)]/50 focus:ring-offset-2 focus:ring-offset-[var(--bg-dark)]"
            >
              Choose Image
            </button>
            {onLoadSample && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onLoadSample();
                }}
                className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors focus:outline-none px-6 py-3 rounded-lg hover:bg-white/5"
              >
                or try a sample
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
