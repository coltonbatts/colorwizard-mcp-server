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
          minRegionArea: params.minRegionArea,
          mergeSmallRegions: params.mergeSmallRegions,
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
            minRegionArea: params.minRegionArea,
            mergeSmallRegions: params.mergeSmallRegions,
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
  }, [imageId, params.paletteSize, params.minRegionArea, params.mergeSmallRegions, triggerPreview]);

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
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto p-4 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-wide">
              Blueprint
            </h1>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-sm text-gray-400">
                Colors: <span className="text-white font-semibold">{palette.length || 0}</span>
              </span>
              {hasDmcData && (
                <span className="text-sm text-gray-400">
                  Threads: <span className="text-white font-semibold">{totalThreads}</span>
                </span>
              )}
            </div>
          </div>
          {/* Mode badge */}
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-1 rounded text-xs font-semibold uppercase ${
                mockMode
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                  : 'bg-green-500/20 text-green-400 border border-green-500/50'
              }`}
            >
              {mockMode ? 'Mock' : 'Live API'}
            </span>
          </div>
        </div>

        {/* Error with switch to mock mode button */}
        {error && !mockMode && (
          <div className="mb-4 p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-red-400 font-semibold mb-1">API Connection Error</p>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
              <button
                onClick={() => {
                  setMockMode(true);
                  setError(null);
                }}
                className="ml-4 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded transition-colors whitespace-nowrap"
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

        {/* Main layout - output dominant */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
          {/* Left: Reference image (collapsible, smaller) */}
          {imageId && (
            <div className="lg:col-span-3">
              <ReferenceImagePanel originalPreviewUrl={originalPreviewUrl} highlightThreshold={highlightThreshold} />
            </div>
          )}

          {/* Center: Output preview (dominant) */}
          <div className={`${imageId ? 'lg:col-span-9' : 'lg:col-span-12'} h-[600px] lg:h-[800px]`}>
            <div className="h-full flex flex-col">
              <h3 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wide">
                Blueprint Output
              </h3>
              <div className="flex-1 bg-black rounded border border-gray-800 relative">
                <BlueprintCanvas
                  previewBase64={previewBase64}
                  originalImageUrl={null}
                  highlightColor={highlightColor}
                  highlightThreshold={highlightThreshold}
                />
                {loading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-white text-sm">{statusMessage || 'Processing...'}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Controls - always visible so mock mode can be toggled before upload */}
        <div className="mb-4">
          <BlueprintControls />
        </div>

        {/* Thread list - prominent, full width */}
        {imageId && (
          <div className="mb-4">
            <PalettePanel />
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
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  if (!originalPreviewUrl) return null;

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-800/50 transition-colors"
      >
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
          Reference Image
        </h3>
        <span className="text-gray-500">{isCollapsed ? '▶' : '▼'}</span>
      </button>
      {!isCollapsed && (
        <div className="h-[400px] p-2">
          <div className="h-full bg-black rounded border border-gray-800">
            <BlueprintCanvas
              previewBase64={null}
              originalImageUrl={originalPreviewUrl}
              highlightColor={null}
              highlightThreshold={highlightThreshold}
            />
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
    // Reset input so same file can be selected again
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
      {/* Upload area */}
      <div
        className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center hover:border-orange-500 transition-colors"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragOver}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-4">
          <p className="text-gray-400">
            {hasImage ? 'Drag a new image here to replace' : 'Drag an image here to upload'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleUploadClick}
              className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors"
            >
              {hasImage ? 'Upload New Image' : 'Upload Image'}
            </button>
            {onLoadSample && (
              <button
                onClick={onLoadSample}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
              >
                {hasImage ? 'Load Sample Image' : 'Use Sample Image'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
