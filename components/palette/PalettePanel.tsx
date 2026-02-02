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
      <div className="p-8 bg-[var(--paper-2)] border border-[var(--border)] h-full">
        <h2 className="text-[10px] font-sans font-bold text-[var(--muted)] uppercase tracking-[0.2em] mb-6">
          Thread Manifest
        </h2>
        <div className="space-y-4">
          <div className="h-[1px] bg-[var(--border)] opacity-30" />
          <p className="text-[11px] text-[var(--muted)] font-sans italic">Awaiting source image processing...</p>
        </div>
      </div>
    );
  }

  // Sort by percent descending
  const sortedPalette = [...palette].sort((a, b) => b.percent - a.percent);

  // Copy thread list functionality
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
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(threadList);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = threadList;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy thread list:', err);
    }
  };

  return (
    <div className="p-8 bg-[var(--paper-2)] border border-[var(--border)] h-full flex flex-col relative">
      <div className="flex items-baseline justify-between mb-8">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[10px] font-sans font-bold text-[var(--muted)] uppercase tracking-[0.2em]">
            Thread Manifest
          </h2>
          <span className="text-[9px] font-sans text-[var(--muted)] opacity-50 font-mono">
            COUNT_{palette.length.toString().padStart(2, '0')}
          </span>
        </div>
        <button
          onClick={copyThreadList}
          className="text-[9px] font-sans font-bold text-[var(--accent)] hover:text-[var(--muted)] uppercase tracking-widest underline underline-offset-4 decoration-[0.5px] transition-colors"
        >
          {copied ? 'Copied' : 'Export .CSV'}
        </button>
      </div>

      <div className="flex flex-col flex-1 overflow-y-auto pr-2 scrollbar-hide">
        {/* Manifest Labels */}
        <div className="flex items-center gap-4 pb-2 hairline-b mb-4">
          <span className="w-8 text-[9px] font-sans font-bold text-[var(--muted)] uppercase tracking-tighter">Color</span>
          <span className="flex-1 text-[9px] font-sans font-bold text-[var(--muted)] uppercase tracking-tighter ml-4">Identification / Specification</span>
          <span className="text-[9px] font-sans font-bold text-[var(--muted)] uppercase tracking-tighter text-right">%</span>
        </div>

        <div className="space-y-0 flex-1">
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
  const hasDmcMatch = color.dmcMatch?.ok && color.dmcMatch.best;
  const isLoadingDmc = !hasDmcMatch && color.dmcMatch?.ok === false;

  return (
    <button
      onClick={onToggleHighlight}
      className={`w-full flex items-center gap-4 py-3 hairline-b transition-all text-left group ${isHighlighted
          ? 'bg-[var(--accent)] text-[var(--white)]'
          : 'bg-transparent text-[var(--ink)] hover:bg-[var(--accent-light)]/50'
        }`}
    >
      {/* Color swatch - square, no border unless white-ish */}
      <div
        className="w-10 h-10 flex-shrink-0"
        style={{
          backgroundColor: color.hex,
          border: color.hex.toLowerCase() === '#ffffff' || color.hex.toLowerCase() === '#f6f1e7' ? '1px solid var(--border)' : 'none'
        }}
      />

      {/* Color info - structured */}
      <div className="flex-1 min-w-0 ml-4">
        {hasDmcMatch ? (
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className={`text-[11px] font-sans font-bold uppercase tracking-tight ${isHighlighted ? 'text-[var(--paper)]' : 'text-[var(--ink)]'}`}>
                DMC_{color.dmcMatch.best.id}
              </span>
              <span className={`text-[9px] font-mono opacity-50 ${isHighlighted ? 'text-[var(--paper)]' : 'text-[var(--muted)]'}`}>
                {color.hex}
              </span>
            </div>
            <div className={`text-[10px] font-sans uppercase tracking-widest mt-0.5 truncate ${isHighlighted ? 'text-[var(--paper)] opacity-80' : 'text-[var(--muted)]'}`}>
              {color.dmcMatch.best.name}
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className={`text-[11px] font-sans font-bold uppercase tracking-tight ${isHighlighted ? 'text-[var(--paper)]' : 'text-[var(--ink)]'}`}>
                COLOR_{index.toString().padStart(2, '0')}
              </span>
              <span className={`text-[9px] font-mono opacity-50 ${isHighlighted ? 'text-[var(--paper)]' : 'text-[var(--muted)]'}`}>
                {color.hex}
              </span>
            </div>
            <div className={`text-[10px] font-sans uppercase tracking-widest mt-0.5 truncate ${isHighlighted ? 'text-[var(--paper)] opacity-80' : 'text-[var(--muted)]'}`}>
              {isLoadingDmc ? 'Processing Match...' : 'Unspecified Dye'}
            </div>
          </div>
        )}
      </div>

      {/* Percentage */}
      <div className={`text-[11px] font-mono tabular-nums pr-2 ${isHighlighted ? 'text-[var(--paper)]' : 'text-[var(--ink)]'}`}>
        {color.percent.toFixed(1).padStart(4, '0')}
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
