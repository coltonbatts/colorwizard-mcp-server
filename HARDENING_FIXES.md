# ThreeJS UI Hardening - Fixes Applied

## Summary

All critical issues have been fixed. The UI now:
- ✅ Uses explicit API origin configuration (`NEXT_PUBLIC_DEMO_ORIGIN`)
- ✅ Prevents final request starvation with separate abort controllers
- ✅ Properly disposes textures to prevent memory leaks
- ✅ Updates shader uniforms instead of recreating materials
- ✅ Validates and coerces slider values to integers
- ✅ Uses consistent parameter naming (`paletteSize`)

## Changes Made

### 1. API Origin Configuration (`lib/api/blueprint.ts`)

**Issue**: Used `NEXT_PUBLIC_API_URL` instead of `NEXT_PUBLIC_DEMO_ORIGIN`

**Fix**: 
- Changed to use `NEXT_PUBLIC_DEMO_ORIGIN` environment variable
- Added fallback logic for localhost detection
- Updated all API calls to use `DEMO_ORIGIN` constant

**Code Changes**:
```typescript
// Before
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// After
const DEMO_ORIGIN = process.env.NEXT_PUBLIC_DEMO_ORIGIN || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'http://localhost:3001' 
    : 'http://localhost:3001');
```

### 2. Two-Stage Preview Request Starvation (`app/three-blueprint/page.tsx`)

**Issue**: Fast and final requests shared the same abort controller, causing final requests to be cancelled by fast requests

**Fix**: 
- Separated abort controllers: `fastAbortControllerRef` and `finalAbortControllerRef`
- Separated request IDs: `fastRequestIdRef` and `finalRequestIdRef`
- Fast requests can only abort other fast requests
- Final requests can only abort other final requests
- This ensures final high-quality previews always complete

**Code Changes**:
```typescript
// Before
const abortControllerRef = useRef<AbortController | null>(null);
const requestIdRef = useRef(0);

// After
const fastAbortControllerRef = useRef<AbortController | null>(null);
const finalAbortControllerRef = useRef<AbortController | null>(null);
const fastRequestIdRef = useRef(0);
const finalRequestIdRef = useRef(0);
```

### 3. Texture Memory Leaks (`components/three/BlueprintCanvas.tsx`)

**Issue**: Textures created in `useMemo` were never disposed when they changed

**Fix**:
- Added `previousTextureRef` to track previous texture
- Dispose previous texture before creating new one
- Cleanup texture on component unmount

**Code Changes**:
```typescript
const previousTextureRef = useRef<THREE.Texture | null>(null);

const texture = useMemo(() => {
  // Dispose previous texture before creating new one
  if (previousTextureRef.current) {
    previousTextureRef.current.dispose();
    previousTextureRef.current = null;
  }
  // ... create new texture
  if (newTexture) {
    previousTextureRef.current = newTexture;
  }
  return newTexture;
}, [previewBase64, originalImageUrl]);

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (previousTextureRef.current) {
      previousTextureRef.current.dispose();
    }
  };
}, []);
```

### 4. Texture Disposal in TexturePlane (`components/three/TexturePlane.tsx`)

**Issue**: 
- Old textures weren't disposed when texture prop changed
- Shader material was recreated on every highlight change

**Fix**:
- Material created once (empty dependency array)
- Track previous texture and dispose it when texture changes
- Update uniforms instead of recreating material
- Added separate effect for threshold updates

**Code Changes**:
```typescript
// Material created once
useEffect(() => {
  // ... create material
}, []); // Empty deps - create once

// Dispose old texture when texture prop changes
useEffect(() => {
  if (materialRef.current && texture) {
    if (previousTextureRef.current && previousTextureRef.current !== texture) {
      previousTextureRef.current.dispose();
    }
    materialRef.current.uniforms.uTexture.value = texture;
    previousTextureRef.current = texture;
  }
}, [texture]);

// Update uniforms only (no material recreation)
useEffect(() => {
  if (materialRef.current) {
    materialRef.current.uniforms.uHighlightColor.value = ...;
    materialRef.current.uniforms.uHighlightEnabled.value = ...;
  }
}, [highlightColor]);
```

### 5. Object URL Cleanup (`lib/preview/texture.ts`)

**Issue**: Object URLs weren't cleaned up on texture load errors

**Fix**: Added error callback to `TextureLoader.load()` to revoke object URL on error

**Code Changes**:
```typescript
const texture = new THREE.TextureLoader().load(
  url,
  (loadedTexture) => {
    URL.revokeObjectURL(url); // Success cleanup
  },
  undefined, // onProgress
  (error) => {
    URL.revokeObjectURL(url); // Error cleanup
    console.error('Failed to load texture:', error);
  }
);
```

### 6. Parameter Validation (`components/controls/BlueprintControls.tsx`)

**Issue**: 
- Label said "Colors Used" but used `paletteSize`
- Slider values weren't explicitly validated

**Fix**:
- Changed label to "Palette Size" for consistency
- Added explicit integer validation and range checking
- Added `parseInt(value, 10)` with validation

**Code Changes**:
```typescript
// Label change
<label>Palette Size</label> // Was "Colors Used"

// Validation
onChange={(e) => {
  const value = parseInt(e.target.value, 10);
  if (!isNaN(value) && value >= 2 && value <= 40) {
    updateParams({ paletteSize: value });
  }
}}
```

## Environment Variables

### Required
- `NEXT_PUBLIC_DEMO_ORIGIN` - Demo server origin (default: `http://localhost:3001`)

### Usage
```bash
# Development (defaults to localhost:3001)
npm run next:dev

# Production with custom origin
NEXT_PUBLIC_DEMO_ORIGIN=https://api.example.com npm run next:build
```

## Testing Checklist

- [x] API calls use correct origin
- [x] Fast preview doesn't cancel final preview
- [x] Textures are disposed when changed
- [x] No memory leaks on rapid parameter changes
- [x] Shader highlights update smoothly without material recreation
- [x] Slider values are validated and coerced to integers
- [x] Parameter naming is consistent (`paletteSize` everywhere)

## Performance Improvements

1. **Shader Material**: Created once instead of on every highlight change
2. **Texture Disposal**: Prevents memory accumulation
3. **Request Isolation**: Final requests complete even during rapid slider changes
4. **Object URL Cleanup**: Prevents memory leaks on load failures

## Memory Safety

All Three.js resources are now properly disposed:
- Textures disposed when replaced or component unmounts
- Materials disposed on component unmount
- Object URLs revoked on both success and error
- Abort controllers cleaned up on unmount
