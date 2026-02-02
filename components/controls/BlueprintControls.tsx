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
    <div className="p-16 lg:p-20 glass-card rounded-xl border-2 border-white/20">
      <div className="mb-20 text-center">
        <h3 className="text-3xl font-serif font-normal text-[var(--text-primary)] mb-4">Fine-Tune Settings</h3>
        <p className="text-base text-[var(--text-muted)]">Adjust these settings to perfect your pattern.</p>
      </div>

      <div className="">
        {/* Simplification */}
        <div className="space-y-8 p-12 glass-card rounded-2xl border-2 border-white/30">
          <div className="flex items-center justify-between mb-6">
            <label className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Detail Level
            </label>
            <span className="text-3xl font-light text-[var(--text-primary)] tabular-nums">{params.simplification}%</span>
          </div>
          <div className="py-6">
            <div className="relative h-6">
              <div className="absolute inset-0 h-6 bg-white/30 rounded-full border border-white/40"></div>
              <div 
                className="absolute inset-0 h-6 bg-[var(--pastel-purple)] rounded-full transition-all border border-[var(--pastel-purple)]"
                style={{ width: `${params.simplification}%` }}
              ></div>
              <input
                type="range"
                min="0"
                max="100"
                value={params.simplification}
                onChange={(e) => updateParams({ simplification: parseInt(e.target.value) })}
                className="relative w-full h-6 bg-transparent appearance-none cursor-pointer focus:outline-none focus:ring-4 focus:ring-[var(--pastel-purple)]/50 z-10 rounded-full"
              />
            </div>
          </div>
          <p className="text-sm text-[var(--text-muted)] text-center leading-relaxed mt-6">
            Higher values create simpler shapes.
          </p>
        </div>

        {/* SPACER */}
        <div style={{ height: '80px' }}></div>

        {/* Smoothing */}
        <div className="space-y-8 p-12 glass-card rounded-2xl border-2 border-white/30">
          <div className="flex items-center justify-between mb-6">
            <label className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Smoothness
            </label>
            <span className="text-3xl font-light text-[var(--text-primary)] tabular-nums">{params.smoothing}%</span>
          </div>
          <div className="py-6">
            <div className="relative h-6">
              <div className="absolute inset-0 h-6 bg-white/30 rounded-full border border-white/40"></div>
              <div 
                className="absolute inset-0 h-6 bg-[var(--pastel-purple)] rounded-full transition-all border border-[var(--pastel-purple)]"
                style={{ width: `${params.smoothing}%` }}
              ></div>
              <input
                type="range"
                min="0"
                max="100"
                value={params.smoothing}
                onChange={(e) => updateParams({ smoothing: parseInt(e.target.value) })}
                className="relative w-full h-6 bg-transparent appearance-none cursor-pointer focus:outline-none focus:ring-4 focus:ring-[var(--pastel-purple)]/50 z-10 rounded-full"
              />
            </div>
          </div>
          <p className="text-sm text-[var(--text-muted)] text-center leading-relaxed mt-6">
            Reduce noise and smooth edges.
          </p>
        </div>

        {/* SPACER */}
        <div style={{ height: '80px' }}></div>

        {/* Min Region Size */}
        <div className="space-y-8 p-12 glass-card rounded-2xl border-2 border-white/30">
          <div className="flex items-center justify-between mb-6">
            <label className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Minimum Size
            </label>
            <span className="text-3xl font-light text-[var(--text-primary)] tabular-nums">{params.minRegionSize}<span className="text-lg text-[var(--text-muted)] ml-2">px</span></span>
          </div>
          <div className="py-6">
            <div className="relative h-6">
              <div className="absolute inset-0 h-6 bg-white/30 rounded-full border border-white/40"></div>
              <div 
                className="absolute inset-0 h-6 bg-[var(--pastel-purple)] rounded-full transition-all border border-[var(--pastel-purple)]"
                style={{ width: `${(params.minRegionSize/1000)*100}%` }}
              ></div>
              <input
                type="range"
                min="0"
                max="1000"
                step="10"
                value={params.minRegionSize}
                onChange={(e) => updateParams({ minRegionSize: parseInt(e.target.value) })}
                className="relative w-full h-6 bg-transparent appearance-none cursor-pointer focus:outline-none focus:ring-4 focus:ring-[var(--pastel-purple)]/50 z-10 rounded-full"
              />
            </div>
          </div>
          <p className="text-sm text-[var(--text-muted)] text-center leading-relaxed mt-6">
            Remove tiny spots.
          </p>
        </div>

        {/* SPACER */}
        <div style={{ height: '80px' }}></div>

        {/* Tone Priority */}
        <div className="space-y-8 p-12 glass-card rounded-2xl border-2 border-white/30">
          <div className="flex items-center justify-between mb-6">
            <label className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Brightness Focus
            </label>
            <span className="text-3xl font-light text-[var(--text-primary)] tabular-nums">{params.toneWeight}%</span>
          </div>
          <div className="py-6">
            <div className="relative h-6">
              <div className="absolute inset-0 h-6 bg-white/30 rounded-full border border-white/40"></div>
              <div 
                className="absolute inset-0 h-6 bg-[var(--pastel-purple)] rounded-full transition-all border border-[var(--pastel-purple)]"
                style={{ width: `${params.toneWeight}%` }}
              ></div>
              <input
                type="range"
                min="0"
                max="100"
                value={params.toneWeight}
                onChange={(e) => updateParams({ toneWeight: parseInt(e.target.value) })}
                className="relative w-full h-6 bg-transparent appearance-none cursor-pointer focus:outline-none focus:ring-4 focus:ring-[var(--pastel-purple)]/50 z-10 rounded-full"
              />
            </div>
          </div>
          <p className="text-sm text-[var(--text-muted)] text-center leading-relaxed mt-6">
            Balance hue and brightness.
          </p>
        </div>
      </div>

      <div className="mt-16 pt-12 border-t-2 border-white/20 flex flex-wrap justify-center gap-8">
        {isMounted && (
          <>
            <label className="flex items-center gap-4 cursor-pointer px-8 py-4 glass-card hover:bg-white/10 rounded-xl transition-all border-2 border-white/20">
              <input
                type="checkbox"
                checked={highQualityPreview}
                onChange={(e) => setHighQualityPreview(e.target.checked)}
                className="w-5 h-5 text-[var(--pastel-purple)] rounded focus:ring-2 focus:ring-[var(--pastel-purple)]/30 bg-white/5 border-white/20"
              />
              <span className="text-base font-semibold text-[var(--text-primary)]">
                High Quality
              </span>
            </label>

            <label className="flex items-center gap-4 cursor-pointer px-8 py-4 glass-card hover:bg-white/10 rounded-xl transition-all border-2 border-white/20">
              <input
                type="checkbox"
                checked={mockMode}
                onChange={(e) => setMockMode(e.target.checked)}
                className="w-5 h-5 text-[var(--pastel-cyan)] rounded focus:ring-2 focus:ring-[var(--pastel-cyan)]/30 bg-white/5 border-white/20"
              />
              <span className="text-base font-semibold text-[var(--text-primary)]">
                Demo Mode
              </span>
            </label>
          </>
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
      <div className="text-xs text-red-700 font-sans">
        <span className="font-medium uppercase tracking-wide">Error:</span> {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-xs text-[var(--muted)] font-sans">
        <span className="font-medium uppercase tracking-wide">Status:</span>{' '}
        {statusMessage || (mode === 'fast' ? 'Processing' : 'Finalizing')}
      </div>
    );
  }

  return (
    <div className="text-xs text-[var(--muted)] font-sans">
      <span className="font-medium uppercase tracking-wide">Status:</span> Ready
    </div>
  );
}
