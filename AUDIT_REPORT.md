# ThreeJS UI Hardening Audit Report

## Issues Found

### 1. API Origin Configuration
**Issue**: Uses `NEXT_PUBLIC_API_URL` instead of `NEXT_PUBLIC_DEMO_ORIGIN` as requested
**Location**: `lib/api/blueprint.ts`
**Impact**: Inconsistent naming, potential confusion

### 2. Two-Stage Preview Request Starvation
**Issue**: Fast requests can abort final requests because they share the same abort controller
**Location**: `app/three-blueprint/page.tsx`
**Impact**: Final high-quality preview may never complete if user keeps adjusting sliders
**Fix**: Use separate abort controllers for fast vs final, or prevent fast from aborting final

### 3. Texture Memory Leaks
**Issue**: 
- `BlueprintCanvas` creates textures in `useMemo` but never disposes old ones
- `TexturePlane` doesn't dispose old textures when texture prop changes
- Object URLs in `texture.ts` aren't tracked for cleanup
**Location**: `components/three/BlueprintCanvas.tsx`, `components/three/TexturePlane.tsx`, `lib/preview/texture.ts`
**Impact**: Memory leaks, especially with frequent texture updates

### 4. Shader Material Recreation
**Issue**: `TexturePlane` recreates the entire shader material when `highlightColor` or `highlightThreshold` changes, instead of just updating uniforms
**Location**: `components/three/TexturePlane.tsx`
**Impact**: Unnecessary GPU resource allocation, potential performance issues

### 5. Parameter Validation
**Issue**: 
- Slider values aren't explicitly coerced to integers
- Label says "Colors Used" but uses `paletteSize` internally
**Location**: `components/controls/BlueprintControls.tsx`
**Impact**: Potential type inconsistencies, user confusion

### 6. Object URL Cleanup
**Issue**: `texture.ts` creates object URLs but doesn't provide a way to clean them up if texture creation fails
**Location**: `lib/preview/texture.ts`
**Impact**: Memory leaks on texture load failures
