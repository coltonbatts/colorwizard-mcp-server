/**
 * Control panel for blueprint parameters
 */

'use client';

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
    <div className="space-y-6 p-4 bg-gray-900 rounded-lg border border-gray-800">
      <h2 className="text-lg font-semibold text-white uppercase tracking-wide">
        Parameters
      </h2>

      {/* Palette Size */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-400 uppercase tracking-wide">
          Palette Size
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="2"
            max="40"
            value={params.paletteSize}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              if (!isNaN(value) && value >= 2 && value <= 40) {
                updateParams({ paletteSize: value });
              }
            }}
            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
          />
          <span className="text-white font-semibold min-w-[3rem] text-right">
            {params.paletteSize}
          </span>
        </div>
      </div>

      {/* Min Region Area */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-400 uppercase tracking-wide">
          Min Region Area
        </label>
        <div className="flex items-center gap-4">
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
            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
          />
          <span className="text-white font-semibold min-w-[3rem] text-right">
            {params.minRegionArea}
          </span>
        </div>
      </div>

      {/* Merge Small Regions Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-400 uppercase tracking-wide">
          Merge Small Regions
        </label>
        <input
          type="checkbox"
          checked={params.mergeSmallRegions}
          onChange={(e) => updateParams({ mergeSmallRegions: e.target.checked })}
          className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-orange-500 focus:ring-orange-500 focus:ring-2"
        />
      </div>

      {/* Mock Mode Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-400 uppercase tracking-wide">
          Mock Mode
        </label>
        <input
          type="checkbox"
          checked={mockMode}
          onChange={(e) => setMockMode(e.target.checked)}
          className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-orange-500 focus:ring-orange-500 focus:ring-2"
        />
      </div>

      {/* High Quality Preview Toggle */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-400 uppercase tracking-wide">
            High Quality Preview
          </label>
          <input
            type="checkbox"
            checked={highQualityPreview}
            onChange={(e) => setHighQualityPreview(e.target.checked)}
            className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-orange-500 focus:ring-orange-500 focus:ring-2"
          />
        </div>
        <p className="text-xs text-gray-500 pl-0">
          Higher quality may be slower on some devices.
        </p>
      </div>

      {/* Status indicator */}
      <div className="pt-4 border-t border-gray-800">
        <StatusIndicator />
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
      <div className="text-sm text-red-400">
        <span className="font-semibold">Error:</span> {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-sm text-gray-400">
        <span className="font-semibold">Status:</span>{' '}
        {statusMessage || (mode === 'fast' ? 'Fast preview...' : 'Final preview...')}
      </div>
    );
  }

  return (
    <div className="text-sm text-gray-500">
      <span className="font-semibold">Status:</span> Ready
    </div>
  );
}
