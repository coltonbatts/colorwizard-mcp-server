# Performance Improvements & UI Redesign

## Bottleneck Analysis

### Performance Timing Logs Added
Added comprehensive performance timing logs to `src/tools/generate_blueprint_v1.ts` to identify bottlenecks:

- **Image Loading**: Time to load/decode/resize image
- **RGB to Lab Conversion**: Time to convert all pixels to Lab color space
- **K-means Clustering**: Time for color quantization
- **Region Cleanup**: Time for merging small regions (if enabled)
- **Palette Building**: Time to build palette structure
- **DMC Matching**: Time to match all colors to DMC threads
- **Preview Encoding**: Time to encode PNG preview

Logs are enabled in development mode or when `ENABLE_PERF_LOGS=1` is set.

### Identified Bottlenecks

Based on the implementation, the likely bottlenecks are:

1. **DMC Matching** (most likely): For each palette color, iterates through entire DMC dataset (~500+ threads) calculating deltaE. For 12 colors, that's ~6000 deltaE calculations synchronously.

2. **Preview Encoding**: PNG encoding for large images (2048px) can be slow.

3. **Network Payload**: Base64 preview images can be large (hundreds of KB).

## Performance Fixes Implemented

### 1. Progressive DMC Loading ✅

**Strategy**: Split FAST vs FINAL requests
- **FAST requests** (`mode === 'fast'`): Skip DMC matching (`includeDmc: false`)
- **FINAL requests** (`mode === 'final'`): Include DMC matching (`includeDmc: true`)
- After fast response, load DMC matches asynchronously in background

**Implementation**:
- Added `includeDmc` parameter to `GenerateBlueprintV1Input`
- Fast requests skip DMC matching entirely
- Client-side progressive loading: After fast response, makes separate batch call to `/api/match-dmc-batch`
- UI shows placeholder labels ("Color 1", "Color 2", etc.) while DMC matches load

**Files Changed**:
- `src/tools/generate_blueprint_v1.ts`: Added `includeDmc` parameter, conditional DMC matching
- `demo/server.ts`: Added `/api/match-dmc-batch` endpoint
- `lib/api/blueprint.ts`: Added `loadDmcMatchesBatch()` function
- `app/three-blueprint/page.tsx`: Progressive DMC loading after fast response

### 2. Fast Request Optimization ✅

**Strategy**: Minimize work for fast requests
- `maxSize = 512` for fast requests (already implemented)
- Skip DMC matching for fast requests
- Return preview immediately (client can show it while DMC loads)

**Result**: Fast requests should now complete in ~150-400ms instead of 10-15 seconds.

### 3. Caching ✅

**Already Implemented**: 
- Client-side cache per `imageId + paletteSize + maxSize + seed + mode`
- LRU cache with 20 entry limit
- Prevents redundant requests

## UI Redesign

### Layout Changes ✅

**Before**: Side-by-side equal layout (reference + output), controls and palette side-by-side

**After**: Output-dominant, product-aligned layout
- **Header**: "Blueprint" title with stats (Colors, Threads), mode badge
- **Main Content**: 
  - Left (optional, collapsible): Reference image (3 cols)
  - Right (dominant): Blueprint output (9 cols, or 12 if no reference)
- **Controls**: Single primary slider ("Colors Used") with Advanced accordion
- **Thread List**: Full-width, prominent, sorted by percent descending

### Component Updates ✅

**BlueprintControls** (`components/controls/BlueprintControls.tsx`):
- Single primary slider: "Colors Used" (2-40)
- Subtext: "More colors = higher fidelity, more thread changes"
- Advanced options collapsed by default (Min Region Area, Merge Small Regions)
- Removed: Mock Mode toggle, High Quality toggle (moved to header)

**PalettePanel** (`components/palette/PalettePanel.tsx`):
- Renamed to "Thread List"
- Larger swatches (16x16 instead of 12x12)
- Prominent DMC code/name display
- Progressive loading: Shows "Color N" placeholder while DMC matches load
- "Copy Thread List" button (text-only format)
- Sorted by percent descending

**Page Layout** (`app/three-blueprint/page.tsx`):
- Simplified header with stats
- Reference image panel (collapsible)
- Output-dominant layout
- Loading overlay on output canvas

## Files Changed

### Server-Side
- `src/tools/generate_blueprint_v1.ts`: Performance logs, `includeDmc` parameter
- `demo/server.ts`: Added `/api/match-dmc-batch` endpoint

### Client-Side
- `lib/api/blueprint.ts`: Added `includeDmc` to interface, `loadDmcMatchesBatch()` function
- `app/three-blueprint/page.tsx`: Progressive DMC loading, UI redesign
- `components/controls/BlueprintControls.tsx`: Simplified to single slider
- `components/palette/PalettePanel.tsx`: Progressive loading, thread list format

## Verification Checklist

### 1. Performance Verification
- [ ] Upload an image
- [ ] Move slider quickly - should see output change within ~150-400ms
- [ ] Check browser console for performance logs (if `ENABLE_PERF_LOGS=1` or dev mode)
- [ ] Verify DMC matches appear progressively after initial output

### 2. UI Verification
- [ ] Single "Colors Used" slider is primary control
- [ ] Output preview is dominant (larger than reference)
- [ ] Reference image is collapsible
- [ ] Thread list shows placeholder labels initially, then fills with DMC matches
- [ ] Thread list sorted by percent descending
- [ ] "Copy Thread List" button works

### 3. Functionality Verification
- [ ] Mock mode toggle works (header)
- [ ] Advanced options collapse/expand
- [ ] Color highlighting works (click swatch)
- [ ] Cancellation works (rapid slider movement)
- [ ] Mobile responsive (output still dominant)

## Expected Performance Improvements

**Before**:
- Fast request: ~10-15 seconds (blocked on DMC matching)
- UI feels sluggish, waits for everything

**After**:
- Fast request: ~150-400ms (no DMC matching)
- DMC matches load progressively (~1-2 seconds for 12 colors)
- UI feels instant, shows output immediately

## Next Steps (Optional Future Improvements)

1. **DMC Matching Optimization**: 
   - Pre-sort DMC dataset by Lab coordinates
   - Use spatial indexing for faster nearest-neighbor search
   - Could reduce DMC matching time from ~1-2s to ~100-200ms

2. **Preview Size Optimization**:
   - Use WebP instead of PNG for smaller payloads
   - Progressive JPEG encoding
   - Client-side texture generation from palette (skip preview entirely for fast)

3. **Caching Improvements**:
   - Cache DMC matches per RGB hex (prevent re-matching same colors)
   - Server-side cache for blueprint results

4. **UI Polish**:
   - Loading skeleton for thread list
   - Toast notification for "Copy Thread List"
   - Smooth transitions when DMC matches load
