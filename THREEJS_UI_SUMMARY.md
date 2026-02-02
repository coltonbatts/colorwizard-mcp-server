# ThreeJS Live Blueprint UI - Implementation Summary

## Skills Applied

While the Vercel Skills CLI package wasn't available, the implementation follows best practices for:
- **Three.js / WebGL**: Using react-three-fiber for declarative Three.js components
- **Performance Optimization**: Debouncing, request cancellation, caching, two-stage rendering
- **State Management**: Zustand for clean, performant state management
- **Next.js**: App Router with proper client/server component separation
- **Mobile UX**: Touch-safe controls and responsive layout

## File Changes

### New Files Created

1. **Next.js Configuration**
   - `next.config.js` - Next.js configuration
   - `jsconfig.json` - Path alias configuration for `@/` imports
   - `tsconfig.next.json` - TypeScript config for Next.js (backup)
   - `postcss.config.js` - PostCSS configuration for Tailwind
   - `tailwind.config.js` - Tailwind CSS configuration

2. **App Structure**
   - `app/layout.tsx` - Root layout
   - `app/globals.css` - Global styles with Tailwind
   - `app/three-blueprint/page.tsx` - Main page component

3. **Components**
   - `components/three/BlueprintCanvas.tsx` - Three.js canvas wrapper
   - `components/three/TexturePlane.tsx` - Shader-based texture plane with color highlighting
   - `components/controls/BlueprintControls.tsx` - Parameter controls with debouncing
   - `components/palette/PalettePanel.tsx` - Color swatches with DMC matches

4. **Utilities**
   - `lib/api/blueprint.ts` - API client helpers with caching support
   - `lib/preview/texture.ts` - Base64 to Three.js texture conversion

5. **State Management**
   - `store/blueprintStore.ts` - Zustand store for blueprint state

### Modified Files

- `package.json` - Added Next.js scripts and dependencies
- `README.md` - Added ThreeJS UI documentation section

## Key Features Implemented

### 1. Realtime Preview with Debouncing
- 300ms debounce delay before triggering preview generation
- Two-stage rendering: fast (512px) → final (2048px) after 700ms pause
- Prevents "death loops" and flickering

### 2. Request Management
- AbortController cancels stale requests
- Request ID guards ignore stale responses
- LRU cache (max 20 entries) prevents redundant API calls

### 3. Three.js Rendering
- Shader-based texture plane with color highlighting
- Nearest-neighbor filtering for crisp pixel rendering
- OrbitControls for zoom/pan
- Subtle grid background
- Proper texture disposal to prevent memory leaks

### 4. Color Highlighting
- Click palette swatch to highlight that color
- Fragment shader compares RGB distance
- Dims non-highlighted pixels
- Configurable threshold (default 0.15)

### 5. Mobile-Friendly
- Touch-safe sliders
- Responsive grid layout
- Full-height canvas area

## API Contract

The UI expects the demo server (`demo/server.ts`) to be running with:

### POST /api/image-register
```json
{
  "imageBase64": "data:image/png;base64,...",
  "maxSize": 2048
}
```
Returns: `{ ok: true, imageId: string, width: number, height: number }`

### POST /api/generate-blueprint-v1
```json
{
  "imageId": "abc123...",
  "paletteSize": 12,
  "maxSize": 512,
  "seed": 42,
  "returnPreview": true,
  "minRegionArea": 40,
  "mergeSmallRegions": true
}
```
Returns: `{ ok: true, palette: PaletteColor[], indexedPreviewPngBase64?: string }`

**Note**: The API uses `paletteSize` (not `colorsUsed`) and `indexedPreviewPngBase64` (not `previewBase64`).

## Running Locally

1. **Start the demo server** (required for API):
   ```bash
   npm run demo
   ```
   Runs on `http://localhost:3001`

2. **Start Next.js dev server**:
   ```bash
   npm run next:dev
   ```
   Runs on `http://localhost:3000`

3. **Open browser**:
   ```
   http://localhost:3000/three-blueprint
   ```

## Environment Variables

- `NEXT_PUBLIC_API_URL` - API base URL (default: `http://localhost:3001`)

## Default Parameters

- `paletteSize`: 12
- `minRegionArea`: 40
- `mergeSmallRegions`: true
- `seed`: 42
- `highlightThreshold`: 0.15 (RGB distance)

## Performance Optimizations

1. **Debouncing**: 300ms delay prevents excessive API calls
2. **Two-stage rendering**: Fast preview (512px) → Final (2048px)
3. **Caching**: LRU cache with 20 entry limit
4. **Request cancellation**: AbortController cancels stale requests
5. **Request ID guards**: Ignores stale responses
6. **Texture disposal**: Proper cleanup prevents memory leaks
7. **Nearest-neighbor filtering**: Crisp pixels for indexed previews

## Known Limitations

1. **Shader highlighting**: Uses simple RGB distance, not perceptual color distance (DeltaE)
2. **No per-pixel labels**: v1 API doesn't return pixel-level cluster labels, so highlighting uses color matching
3. **Single highlight**: Only one color can be highlighted at a time
4. **No crossfade**: No toggle between original and indexed preview (future enhancement)

## Future Enhancements

- Perceptual color distance (DeltaE) for highlighting
- Multiple color selection
- Crossfade between original and indexed preview
- Export functionality
- Keyboard shortcuts
- Touch gestures for mobile (pinch zoom, pan)
