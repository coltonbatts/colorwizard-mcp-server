/**
 * ThreeJS Live Blueprint page
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { BlueprintCanvas } from '@/components/three/BlueprintCanvas';
import { BlueprintControls } from '@/components/controls/BlueprintControls';
import { PalettePanel, useHighlightColor } from '@/components/palette/PalettePanel';
import { useBlueprintStore } from '@/store/blueprintStore';
import { registerImage, generateBlueprintV1, getCacheKey } from '@/lib/api/blueprint';

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

  const highlightColor = useHighlightColor();
  const highlightThreshold = 0.15; // RGB distance threshold for highlighting

  // Helper to get final preview maxSize based on toggle and device type
  const getFinalMaxSize = useCallback(() => {
    // If high quality toggle is ON, always use 2048
    if (highQualityPreview) {
      return FINAL_MAX_SIZE_DESKTOP;
    }
    // Otherwise use device-appropriate default
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return FINAL_MAX_SIZE_MOBILE;
    }
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

    setError(null);
    setLastResponse(null);
    setImageId(null);
    setOriginalPreviewUrl(null);

    // Create object URL for immediate preview
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
          maxSize: FINAL_MAX_SIZE,
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
        setError(err instanceof Error ? err.message : 'Failed to register image');
        setLoading(false);
        setStatusMessage(null);
      }
    };
    reader.readAsDataURL(file);
  }, [setImageId, setOriginalPreviewUrl, setError, setLoading, setStatusMessage, setLastResponse]);

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
          abortControllerRef.current.signal
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (fastAbortControllerRef.current) {
        fastAbortControllerRef.current.abort();
      }
      if (finalAbortControllerRef.current) {
        finalAbortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (finalPreviewTimerRef.current) {
        clearTimeout(finalPreviewTimerRef.current);
      }
      if (originalPreviewUrl) {
        URL.revokeObjectURL(originalPreviewUrl);
      }
    };
  }, [originalPreviewUrl]);

  const previewBase64 = lastResponse?.indexedPreviewPngBase64 || null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-2 uppercase tracking-wide">
          ThreeJS Live Blueprint
        </h1>
        <p className="text-gray-400 mb-6">
          Upload an image and preview realtime color quantization with Three.js
        </p>

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
