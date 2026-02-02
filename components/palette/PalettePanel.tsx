/**
 * Palette panel displaying color swatches with DMC matches
 */

'use client';

import { useBlueprintStore } from '@/store/blueprintStore';
import type { PaletteColor } from '@/lib/api/blueprint';

export function PalettePanel() {
  const lastResponse = useBlueprintStore((state) => state.lastResponse);
  const highlightedColorIndex = useBlueprintStore((state) => state.highlightedColorIndex);
  const setHighlightedColorIndex = useBlueprintStore((state) => state.setHighlightedColorIndex);

  const palette = lastResponse?.palette || [];

  if (palette.length === 0) {
    return (
      <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
        <h2 className="text-lg font-semibold text-white uppercase tracking-wide mb-4">
          Palette
        </h2>
        <p className="text-gray-500 text-sm">Upload an image to generate a palette</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
      <h2 className="text-lg font-semibold text-white uppercase tracking-wide mb-4">
        Palette ({palette.length} colors)
      </h2>
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {palette.map((color, index) => (
          <PaletteItem
            key={index}
            color={color}
            index={index}
            isHighlighted={highlightedColorIndex === index}
            onToggleHighlight={() => {
              setHighlightedColorIndex(
                highlightedColorIndex === index ? null : index
              );
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface PaletteItemProps {
  color: PaletteColor;
  index: number;
  isHighlighted: boolean;
  onToggleHighlight: () => void;
}

function PaletteItem({ color, index, isHighlighted, onToggleHighlight }: PaletteItemProps) {
  // Convert RGB array to normalized [0-1] for shader
  const rgbNormalized: [number, number, number] = [
    color.rgb[0] / 255,
    color.rgb[1] / 255,
    color.rgb[2] / 255,
  ];

  return (
    <button
      onClick={onToggleHighlight}
      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
        isHighlighted
          ? 'bg-orange-500/20 border-orange-500 ring-2 ring-orange-500'
          : 'bg-gray-800 border-gray-700 hover:border-gray-600'
      }`}
    >
      {/* Color swatch */}
      <div
        className="w-12 h-12 rounded border border-gray-600 flex-shrink-0"
        style={{ backgroundColor: color.hex }}
      />

      {/* Color info */}
      <div className="flex-1 min-w-0 text-left">
        <div className="font-semibold text-white text-sm">{color.hex}</div>
        <div className="text-xs text-gray-400 mt-1">
          {color.dmcMatch?.ok && color.dmcMatch.best ? (
            <>
              {color.dmcMatch.best.id} - {color.dmcMatch.best.name}
              {color.dmcMatch.best.deltaE !== undefined && (
                <span className="ml-2 text-gray-500">
                  (ΔE: {color.dmcMatch.best.deltaE.toFixed(2)})
                </span>
              )}
            </>
          ) : (
            'No DMC match'
          )}
        </div>
      </div>

      {/* Percentage */}
      <div className="text-white font-semibold text-sm min-w-[4rem] text-right">
        {color.percent.toFixed(1)}%
      </div>
    </button>
  );
}

// Export helper to get highlight color from store
export function useHighlightColor(): [number, number, number] | null {
  const lastResponse = useBlueprintStore((state) => state.lastResponse);
  const highlightedColorIndex = useBlueprintStore((state) => state.highlightedColorIndex);

  if (
    highlightedColorIndex !== null &&
    lastResponse?.palette &&
    lastResponse.palette[highlightedColorIndex]
  ) {
    const color = lastResponse.palette[highlightedColorIndex];
    return [color.rgb[0] / 255, color.rgb[1] / 255, color.rgb[2] / 255];
  }

  return null;
}
