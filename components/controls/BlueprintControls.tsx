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

  return (
    <div className="p-6 bg-[var(--paper-2)] rounded border border-[var(--border)]">
      {/* Advanced options (collapsed by default) */}
      <details className="mt-0" open={false}>
        <summary className="cursor-pointer text-xs font-serif font-medium text-[var(--muted)] hover:text-[var(--ink)] mb-3 uppercase tracking-wider">
          Advanced
        </summary>
        <div className="space-y-5 pt-4">
          {/* Min Region Area */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-sans font-medium text-[var(--ink)]">
                Min Region Area
              </label>
              <span className="px-2.5 py-1 bg-[var(--accent)] text-[var(--paper)] font-sans font-semibold text-xs rounded-full min-w-[2.5rem] text-center">
                {params.minRegionArea}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="500"
              step="10"
              value={params.minRegionArea}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value) && value >= 0 && value <= 500) {
                  updateParams({ minRegionArea: value });
                }
              }}
              className="flex-1 h-1 bg-[var(--border)] rounded-full appearance-none cursor-pointer accent-[var(--accent)]"
              style={{
                background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${(params.minRegionArea / 500) * 100}%, var(--border) ${(params.minRegionArea / 500) * 100}%, var(--border) 100%)`
              }}
            />
          </div>

          {/* Merge Small Regions Toggle */}
          <div className="flex items-center justify-between py-1">
            <label className="text-sm font-sans font-medium text-[var(--ink)]">
              Merge Small Regions
            </label>
            <input
              type="checkbox"
              checked={params.mergeSmallRegions}
              onChange={(e) => updateParams({ mergeSmallRegions: e.target.checked })}
              className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] focus:ring-1 cursor-pointer"
            />
          </div>

          {/* High Quality Preview Toggle */}
          <div className="flex items-center justify-between py-1">
            <label className="text-sm font-sans font-medium text-[var(--ink)]">
              High Quality Preview
            </label>
            <input
              type="checkbox"
              checked={highQualityPreview}
              onChange={(e) => setHighQualityPreview(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] focus:ring-1 cursor-pointer"
            />
          </div>

          {/* Mock Mode Toggle */}
          <div className="flex items-center justify-between py-1">
            <label className="text-sm font-sans font-medium text-[var(--ink)]">
              Mock Mode
            </label>
            <input
              type="checkbox"
              checked={mockMode}
              onChange={(e) => setMockMode(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] focus:ring-1 cursor-pointer"
            />
          </div>
        </div>
      </details>

      {/* Status indicator */}
      {loading && (
        <div className="mt-5 pt-5 border-t border-[var(--border)]">
          <StatusIndicator />
        </div>
      )}
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
