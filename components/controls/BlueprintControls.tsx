/**
 * Control panel for blueprint parameters
 */

'use client';

import React from 'react';
import { useBlueprintStore } from '@/store/blueprintStore';

export function BlueprintControls() {
  const params = useBlueprintStore((state) => state.params);
  const updateParams = useBlueprintStore((state) => state.updateParams);
  const loading = useBlueprintStore((state) => state.loading);
  const highQualityPreview = useBlueprintStore((state) => state.highQualityPreview);
  const setHighQualityPreview = useBlueprintStore((state) => state.setHighQualityPreview);
  const mockMode = useBlueprintStore((state) => state.mockMode);
  const setMockMode = useBlueprintStore((state) => state.setMockMode);

  // Client-only state to prevent hydration mismatch for mockMode/highQualityPreview
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div className="p-8 bg-[var(--paper-2)] border border-[var(--border)] relative overflow-hidden">
      <div className="absolute top-0 right-0 p-2 opacity-5">
        <span className="text-4xl font-serif font-bold italic select-none">Artistic Control</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
        {/* Simplification */}
        <div className="space-y-4">
          <div className="flex items-baseline justify-between overflow-hidden">
            <label className="text-[10px] font-sans font-bold text-[var(--muted)] uppercase tracking-[0.2em] whitespace-nowrap">
              Simplification
            </label>
            <div className="h-[1px] bg-[var(--border)] flex-grow mx-4 opacity-50" />
            <span className="text-lg font-serif italic tabular-nums">{params.simplification}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={params.simplification}
            onChange={(e) => updateParams({ simplification: parseInt(e.target.value) })}
            className="w-full h-[1px] bg-[var(--border)] appearance-none cursor-pointer accent-[var(--accent)]"
          />
          <p className="text-[9px] text-[var(--muted)] font-sans uppercase tracking-widest opacity-70">
            Merges similar regions for broad artistic shapes
          </p>
        </div>

        {/* Smoothing */}
        <div className="space-y-4">
          <div className="flex items-baseline justify-between overflow-hidden">
            <label className="text-[10px] font-sans font-bold text-[var(--muted)] uppercase tracking-[0.2em] whitespace-nowrap">
              Smoothing
            </label>
            <div className="h-[1px] bg-[var(--border)] flex-grow mx-4 opacity-50" />
            <span className="text-lg font-serif italic tabular-nums">{params.smoothing}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={params.smoothing}
            onChange={(e) => updateParams({ smoothing: parseInt(e.target.value) })}
            className="w-full h-[1px] bg-[var(--border)] appearance-none cursor-pointer accent-[var(--accent)]"
          />
          <p className="text-[9px] text-[var(--muted)] font-sans uppercase tracking-widest opacity-70">
            Removes digital grain and compression artifacts
          </p>
        </div>

        {/* Min Region Size */}
        <div className="space-y-4">
          <div className="flex items-baseline justify-between overflow-hidden">
            <label className="text-[10px] font-sans font-bold text-[var(--muted)] uppercase tracking-[0.2em] whitespace-nowrap">
              Min Region
            </label>
            <div className="h-[1px] bg-[var(--border)] flex-grow mx-4 opacity-50" />
            <span className="text-lg font-serif italic tabular-nums">{params.minRegionSize}px</span>
          </div>
          <input
            type="range"
            min="0"
            max="1000"
            step="10"
            value={params.minRegionSize}
            onChange={(e) => updateParams({ minRegionSize: parseInt(e.target.value) })}
            className="w-full h-[1px] bg-[var(--border)] appearance-none cursor-pointer accent-[var(--accent)]"
          />
          <p className="text-[9px] text-[var(--muted)] font-sans uppercase tracking-widest opacity-70">
            Eliminates small speckles for cleaner stitch paths
          </p>
        </div>

        {/* Tone Priority */}
        <div className="space-y-4">
          <div className="flex items-baseline justify-between overflow-hidden">
            <label className="text-[10px] font-sans font-bold text-[var(--muted)] uppercase tracking-[0.2em] whitespace-nowrap">
              Tone Priority
            </label>
            <div className="h-[1px] bg-[var(--border)] flex-grow mx-4 opacity-50" />
            <span className="text-lg font-serif italic tabular-nums">{params.toneWeight}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={params.toneWeight}
            onChange={(e) => updateParams({ toneWeight: parseInt(e.target.value) })}
            className="w-full h-[1px] bg-[var(--border)] appearance-none cursor-pointer accent-[var(--accent)]"
          />
          <p className="text-[9px] text-[var(--muted)] font-sans uppercase tracking-widest opacity-70">
            Balances color accuracy against tonal structure
          </p>
        </div>
      </div>

      <div className="mt-12 pt-6 border-t border-[var(--border)] flex flex-wrap gap-x-8 gap-y-4">
        {isMounted && (
          <>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={highQualityPreview}
                onChange={(e) => setHighQualityPreview(e.target.checked)}
                className="w-3 h-3 border-[var(--border)] text-[var(--accent)] rounded-none focus:ring-0"
              />
              <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-[var(--muted)] group-hover:text-[var(--ink)] transition-colors">
                High Density Spec
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={mockMode}
                onChange={(e) => setMockMode(e.target.checked)}
                className="w-3 h-3 border-[var(--border)] text-[var(--accent)] rounded-none focus:ring-0"
              />
              <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-[var(--muted)] group-hover:text-[var(--ink)] transition-colors">
                Sandbox Mode
              </span>
            </label>
          </>
        )}

        {loading && (
          <div className="flex-grow flex justify-end">
            <StatusIndicator />
          </div>
        )}
      </div>
    </div>
  );
}

function StatusIndicator() {
  const loading = useBlueprintStore((state) => state.loading);
  const statusMessage = useBlueprintStore((state) => state.statusMessage);
  const error = useBlueprintStore((state) => state.error);
  const mode = useBlueprintStore((state) => state.mode);

  if (error) {
    return (
      <div className="text-sm text-red-700 font-sans">
        <span className="font-semibold">Error:</span> {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-sm text-[var(--muted)] font-sans">
        <span className="font-semibold">Status:</span>{' '}
        {statusMessage || (mode === 'fast' ? 'Fast preview...' : 'Final preview...')}
      </div>
    );
  }

  return (
    <div className="text-sm text-[var(--muted)] font-sans">
      <span className="font-semibold">Status:</span> Ready
    </div>
  );
}
