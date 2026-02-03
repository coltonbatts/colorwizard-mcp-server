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
      <div className="p-8 glass-card rounded-xl h-full relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center text-center h-full justify-center">
          <div className="w-16 h-16 glass-card rounded-xl flex items-center justify-center mb-6 border border-white/10">
            <svg className="w-8 h-8 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </div>
          <h2 className="text-lg font-serif font-normal text-[var(--text-primary)] mb-3">
            Thread Colors
          </h2>
          <p className="text-sm text-[var(--text-muted)]">Upload an image to see your thread colors</p>
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
    <div className="p-6 lg:p-8 glass-card rounded-xl h-full flex flex-col relative overflow-hidden">
      <div className="relative z-10 flex flex-col mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-lg font-serif font-normal text-[var(--text-primary)]">
            Thread Colors
          </h2>
          <span className="text-sm text-[var(--text-muted)] tabular-nums">{palette.length}</span>
        </div>
        
        <button
          onClick={copyThreadList}
          className="self-start px-4 py-2 glass-card hover:bg-white/10 text-[var(--text-secondary)] font-medium text-xs uppercase tracking-wider rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-[var(--pastel-purple)]/30 border border-white/10"
        >
          {copied ? '✓ Copied' : 'Copy List'}
        </button>
      </div>

      <div className="flex flex-col flex-1 overflow-y-auto -mr-2 pr-2 space-y-3 relative z-10">
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
  const dmcBest = color.dmcMatch?.ok ? color.dmcMatch.best : undefined;
  const hasDmcMatch = Boolean(dmcBest);
  const isLoadingDmc = !hasDmcMatch && color.dmcMatch?.ok === false;

  return (
    <button
      onClick={onToggleHighlight}
      className={`w-full flex items-center gap-4 p-4 rounded-lg transition-all text-left group focus:outline-none focus:ring-2 focus:ring-[var(--pastel-purple)]/30 ${isHighlighted
          ? 'bg-[var(--pastel-purple)] scale-[1.01]'
          : 'glass-card hover:bg-white/10'
        }`}
    >
      {/* Color swatch */}
      <div
        className={`w-12 h-12 flex-shrink-0 rounded-lg transition-all ${isHighlighted ? 'ring-2 ring-white/30' : ''}`}
        style={{
          backgroundColor: color.hex,
          border: color.hex.toLowerCase() === '#ffffff' || color.hex.toLowerCase() === '#f6f1e7' ? '1px solid rgba(255,255,255,0.2)' : 'none'
        }}
      />

      {/* Color info */}
      <div className="flex-1 min-w-0">
        {hasDmcMatch ? (
          <div className="flex flex-col gap-1">
            <div className={`text-sm font-semibold ${isHighlighted ? 'text-white' : 'text-[var(--text-primary)]'}`}>
              DMC {dmcBest?.id}
            </div>
            <div className={`text-xs capitalize truncate ${isHighlighted ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>
              {dmcBest?.name.toLowerCase()}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className={`text-sm font-semibold ${isHighlighted ? 'text-white' : 'text-[var(--text-primary)]'}`}>
              Color {index + 1}
            </div>
            <div className={`text-xs ${isHighlighted ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>
              {isLoadingDmc ? 'Finding match...' : color.hex}
            </div>
          </div>
        )}
      </div>

      {/* Percentage badge */}
      <div className={`px-3 py-1.5 rounded-md text-xs font-semibold tabular-nums ${isHighlighted ? 'bg-white/20 text-white' : 'glass-card text-[var(--text-secondary)]'}`}>
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
