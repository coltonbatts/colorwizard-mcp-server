/**
 * Palette panel displaying color swatches with DMC matches
 */

'use client';

import React from 'react';
import { useBlueprintStore } from '@/store/blueprintStore';
import type { PaletteColor } from '@/lib/api/blueprint';

export function PalettePanel() {
  const lastResponse = useBlueprintStore((state) => state.lastResponse);
  const highlightedColorIndex = useBlueprintStore((state) => state.highlightedColorIndex);
  const setHighlightedColorIndex = useBlueprintStore((state) => state.setHighlightedColorIndex);
  const [copied, setCopied] = React.useState(false);

  const palette = lastResponse?.palette || [];

  if (palette.length === 0) {
    return (
      <div className="p-6 bg-[var(--paper-2)] rounded border border-[var(--border)]">
        <h2 className="text-xs font-serif font-medium text-[var(--muted)] uppercase tracking-wider mb-4">
          Threads Required
        </h2>
        <p className="text-[var(--muted)] text-sm font-sans">Upload an image to generate a thread list</p>
      </div>
    );
  }

  // Sort by percent descending
  const sortedPalette = [...palette].sort((a, b) => b.percent - a.percent);

  // Copy thread list functionality with fallback
  const copyThreadList = async () => {
    const threadList = sortedPalette
      .map((color) => {
        if (color.dmcMatch?.ok && color.dmcMatch.best) {
          return `DMC ${color.dmcMatch.best.id} - ${color.dmcMatch.best.name} - ${color.percent.toFixed(1)}%`;
        }
        return `Color ${color.hex} - ${color.percent.toFixed(1)}%`;
      })
      .join('\n');
    
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(threadList);
      } else {
        // Fallback to textarea method
        const textarea = document.createElement('textarea');
        textarea.value = threadList;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      
      // Show confirmation
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy thread list:', err);
    }
  };

  const paletteSize = palette.length;

  return (
    <div className="p-6 bg-[var(--paper-2)] rounded border border-[var(--border)] h-full flex flex-col">
      {/* Header row: Title + count pill + Copy list */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-serif font-medium text-[var(--muted)] uppercase tracking-wider">
            Threads Required
          </h2>
          {paletteSize > 0 && (
            <span className="px-2 py-0.5 bg-[var(--accent)] text-[var(--paper)] font-sans font-semibold text-[10px] rounded-full">
              {paletteSize}
            </span>
          )}
        </div>
        <div className="relative">
          <button
            onClick={copyThreadList}
            className="px-3 py-1.5 text-xs font-sans font-medium bg-transparent border border-[var(--border)] hover:bg-[var(--accent-light)] text-[var(--ink)] rounded transition-colors"
          >
            Copy list
          </button>
          {copied && (
            <span className="absolute -top-7 right-0 px-2 py-1 text-xs bg-green-100 text-green-700 border border-green-200 rounded-full whitespace-nowrap font-sans">
              Copied
            </span>
          )}
        </div>
      </div>
      <div className="space-y-2 flex-1 overflow-y-auto">
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
      className={`w-full flex items-start gap-3 p-3 rounded border transition-all text-left ${
        isHighlighted
          ? 'bg-[var(--accent-light)] border-[var(--accent)] ring-1 ring-[var(--accent)]'
          : 'bg-[var(--paper)] border-[var(--border)] hover:bg-[var(--accent-light)] hover:border-[var(--muted)]'
      }`}
    >
      {/* Color swatch - larger */}
      <div
        className="w-8 h-8 rounded border border-[var(--border)] flex-shrink-0 shadow-sm"
        style={{ backgroundColor: color.hex }}
      />

      {/* Color info - bill of materials style */}
      <div className="flex-1 min-w-0">
        {hasDmcMatch ? (
          <>
            <div className="font-sans font-bold text-[var(--ink)] text-sm">
              {color.dmcMatch.best.id}
            </div>
            <div className="text-xs text-[var(--muted)] mt-0.5 font-sans">
              {color.dmcMatch.best.name}
            </div>
            <div className="text-[10px] text-[var(--muted)] mt-0.5 font-sans opacity-60">
              {color.hex}
            </div>
          </>
        ) : isLoadingDmc ? (
          <>
            <div className="font-sans font-medium text-[var(--muted)] text-sm">
              Color {index + 1}
            </div>
            <div className="text-xs text-[var(--muted)] mt-0.5 font-sans opacity-75">
              Loading thread match...
            </div>
          </>
        ) : (
          <>
            <div className="font-sans font-medium text-[var(--muted)] text-sm">
              Color {index + 1}
            </div>
            <div className="text-[10px] text-[var(--muted)] mt-0.5 font-sans opacity-60">
              {color.hex}
            </div>
          </>
        )}
      </div>

      {/* Percentage - right aligned */}
      <div className="text-[var(--ink)] font-sans font-semibold text-sm min-w-[3.5rem] text-right pt-0.5">
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
