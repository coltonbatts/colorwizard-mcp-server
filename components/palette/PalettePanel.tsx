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
          Thread List
        </h2>
        <p className="text-gray-500 text-sm">Upload an image to generate a thread list</p>
      </div>
    );
  }

  // Sort by percent descending
  const sortedPalette = [...palette].sort((a, b) => b.percent - a.percent);

  // Copy thread list functionality
  const copyThreadList = () => {
    const threadList = sortedPalette
      .map((color, index) => {
        if (color.dmcMatch?.ok && color.dmcMatch.best) {
          return `${index + 1}. ${color.dmcMatch.best.id} - ${color.dmcMatch.best.name} (${color.percent.toFixed(1)}%)`;
        }
        return `${index + 1}. Color ${index + 1} - ${color.hex} (${color.percent.toFixed(1)}%)`;
      })
      .join('\n');
    
    navigator.clipboard.writeText(threadList).then(() => {
      // Could add a toast notification here
    });
  };

  return (
    <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white uppercase tracking-wide">
          Thread List ({palette.length} colors)
        </h2>
        <button
          onClick={copyThreadList}
          className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded border border-gray-700 transition-colors"
        >
          Copy Thread List
        </button>
      </div>
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {sortedPalette.map((color, index) => (
          <PaletteItem
            key={index}
            color={color}
            index={palette.indexOf(color)}
            isHighlighted={highlightedColorIndex === palette.indexOf(color)}
            onToggleHighlight={() => {
              setHighlightedColorIndex(
                highlightedColorIndex === palette.indexOf(color) ? null : palette.indexOf(color)
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

  const hasDmcMatch = color.dmcMatch?.ok && color.dmcMatch.best;
  const isLoadingDmc = !hasDmcMatch && color.dmcMatch?.ok === false;

  return (
    <button
      onClick={onToggleHighlight}
      className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-all ${
        isHighlighted
          ? 'bg-orange-500/20 border-orange-500 ring-2 ring-orange-500'
          : 'bg-gray-800 border-gray-700 hover:border-gray-600'
      }`}
    >
      {/* Color swatch - larger */}
      <div
        className="w-16 h-16 rounded border-2 border-gray-600 flex-shrink-0"
        style={{ backgroundColor: color.hex }}
      />

      {/* Color info - more prominent */}
      <div className="flex-1 min-w-0 text-left">
        {hasDmcMatch ? (
          <>
            <div className="font-bold text-white text-base">
              {color.dmcMatch.best.id}
            </div>
            <div className="text-sm text-gray-300 mt-1">
              {color.dmcMatch.best.name}
            </div>
            {color.dmcMatch.best.deltaE !== undefined && (
              <div className="text-xs text-gray-500 mt-1">
                ΔE: {color.dmcMatch.best.deltaE.toFixed(2)}
              </div>
            )}
          </>
        ) : isLoadingDmc ? (
          <>
            <div className="font-semibold text-gray-400 text-base">
              Color {index + 1}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Loading thread match...
            </div>
          </>
        ) : (
          <>
            <div className="font-semibold text-gray-400 text-base">
              Color {index + 1}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {color.hex}
            </div>
          </>
        )}
      </div>

      {/* Percentage - larger */}
      <div className="text-white font-bold text-lg min-w-[5rem] text-right">
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
