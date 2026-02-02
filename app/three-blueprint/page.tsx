/**
 * ThreeJS Live Blueprint page
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { BlueprintCanvas } from '@/components/three/BlueprintCanvas';
import { BlueprintControls } from '@/components/controls/BlueprintControls';
import { PalettePanel, useHighlightColor } from '@/components/palette/PalettePanel';
import { useBlueprintStore } from '@/store/blueprintStore';
import { registerImage, generateBlueprintV1, getCacheKey, setMockModeEnabled, getDemoOrigin } from '@/lib/api/blueprint';

const DEBOUNCE_MS = 300;
const FINAL_PREVIEW_DELAY_MS = 700;
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
              maxSize: FINAL_MAX_SIZE_DESKTOP, // Use desktop max size for sample image registration
            });
            
            if (registerResult.ok && registerResult.imageId) {
              setImageId(registerResult.imageId);
              setLoading(false);
              setStatusMessage(null);
              // Trigger preview after a short delay to ensure state is updated
              setTimeout(() => {
                triggerPreview(true);
              }, 100);
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

        // Register image
        const registerResult = await registerImage({
          imageBase64: base64,
          maxSize: FINAL_MAX_SIZE_DESKTOP, // Use desktop max size for image registration
        });

        if (!registerResult.ok || !registerResult.imageId) {
          throw new Error(registerResult.error || 'Failed to register image');
        }

        setImageId(registerResult.imageId);
        setLoading(false);
        setStatusMessage(null);

        // Trigger initial preview
        triggerPreview(true);
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
        setLastResponse(cached);
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
        const response = await generateBlueprintV1(
          {
            imageId,
            paletteSize: params.paletteSize,
            maxSize,
            seed: params.seed,
            returnPreview: true,
            minRegionArea: params.minRegionArea,
            mergeSmallRegions: params.mergeSmallRegions,
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

        // Cache and update state
        cacheResponse(cacheKey, response);
        setLastResponse(response);
        setLoading(false);
        setStatusMessage(null);
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

  // Trigger preview with debouncing
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

      // Debounce: wait before generating fast preview
      debounceTimerRef.current = setTimeout(() => {
        generatePreview(FAST_MAX_SIZE, 'fast', isInitial);

        // After user stops, generate final preview with device-appropriate maxSize
        finalPreviewTimerRef.current = setTimeout(() => {
          const finalMaxSize = getFinalMaxSize();
          generatePreview(finalMaxSize, 'final', false);
        }, FINAL_PREVIEW_DELAY_MS);
      }, DEBOUNCE_MS);
    },
    [imageId, generatePreview, getFinalMaxSize]
  );

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

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold uppercase tracking-wide">
            ThreeJS Live Blueprint
          </h1>
          {/* Mode badge and diagnostics */}
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                mockMode
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                  : 'bg-green-500/20 text-green-400 border border-green-500/50'
              }`}
            >
              {mockMode ? 'Mock' : 'Live API'}
            </span>
            {/* Diagnostics */}
            <div className="text-xs text-gray-500 font-mono">
              {mockMode ? (
                <span className="text-yellow-400">Mock Mode</span>
              ) : (
                <span className="text-gray-400" title={`Demo server origin: ${getDemoOrigin()}`}>
                  {getDemoOrigin()}
                </span>
              )}
            </div>
          </div>
        </div>
        <p className="text-gray-400 mb-6">
          Upload an image and preview realtime color quantization with Three.js
        </p>

        {/* Error with switch to mock mode button */}
        {error && !mockMode && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-red-400 font-semibold mb-1">API Connection Error</p>
                <p className="text-red-300 text-sm mb-2">{error}</p>
                <div className="text-xs text-gray-400 font-mono mt-2 p-2 bg-black/30 rounded">
                  <div>Current DEMO_ORIGIN: {getDemoOrigin()}</div>
                  <div className="mt-1">
                    To fix: Run <code className="text-yellow-400">npm run demo</code> (default port: 3001)
                  </div>
                  <div className="mt-1">
                    Or set <code className="text-yellow-400">NEXT_PUBLIC_DEMO_ORIGIN</code> in .env.local to match your server port
                  </div>
                </div>
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

        {/* File upload */}
        <div className="mb-6">
          <FileUpload onFileSelect={handleFileUpload} />
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Three.js canvas - takes 3 columns on large screens */}
          <div className="lg:col-span-3 h-[600px] lg:h-[800px]">
            <BlueprintCanvas
              previewBase64={previewBase64}
              originalImageUrl={originalPreviewUrl}
              highlightColor={highlightColor}
              highlightThreshold={highlightThreshold}
            />
          </div>

          {/* Controls and palette - 1 column on large screens */}
          <div className="lg:col-span-1 space-y-4">
            <BlueprintControls />
            <PalettePanel />
          </div>
        </div>
      </div>
    </div>
  );
}

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

function FileUpload({ onFileSelect }: FileUploadProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      onFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <div
      className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center cursor-pointer hover:border-orange-500 transition-colors"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => document.getElementById('file-input')?.click()}
    >
      <input
        id="file-input"
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />
      <p className="text-gray-400">
        Click to upload or drag image here
      </p>
    </div>
  );
}
