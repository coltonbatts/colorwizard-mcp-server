/**
 * Utilities for converting base64 images to Three.js textures
 */

import * as THREE from 'three';

/**
 * Convert a base64 PNG string to a Three.js texture
 * @param base64Data Base64 string (with or without data URL prefix)
 * @param options Texture options
 * @returns Three.js texture
 * 
 * NOTE: Object URLs are automatically cleaned up when the texture loads.
 * If texture creation fails, the object URL will be cleaned up on error.
 * Callers should dispose textures using disposeTexture() when done.
 */
export function base64ToTexture(
  base64Data: string,
  options?: {
    minFilter?: THREE.MinificationTextureFilter;
    magFilter?: THREE.MagnificationTextureFilter;
    generateMipmaps?: boolean;
  }
): THREE.Texture {
  // Remove data URL prefix if present
  const base64 = base64Data.startsWith('data:') 
    ? base64Data.split(',')[1] 
    : base64Data;

  // Convert base64 to binary string
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Create image from bytes
  const blob = new Blob([bytes], { type: 'image/png' });
  const url = URL.createObjectURL(blob);

  // Create texture with cleanup on both success and error
  const texture = new THREE.TextureLoader().load(
    url,
    (loadedTexture) => {
      // Clean up object URL after texture is loaded successfully
      URL.revokeObjectURL(url);
    },
    undefined, // onProgress (not used)
    (error) => {
      // Clean up object URL on error to prevent memory leak
      URL.revokeObjectURL(url);
      console.error('Failed to load texture from base64:', error);
    }
  );

  // Apply options
  if (options?.minFilter !== undefined) {
    texture.minFilter = options.minFilter;
  }
  if (options?.magFilter !== undefined) {
    texture.magFilter = options.magFilter;
  }
  if (options?.generateMipmaps !== undefined) {
    texture.generateMipmaps = options.generateMipmaps;
  }

  // For indexed/preview images, use nearest neighbor filtering for crisp pixels
  if (options?.magFilter === THREE.NearestFilter || options?.minFilter === THREE.NearestFilter) {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
  }

  return texture;
}

/**
 * Convert a regular image URL or object URL to a Three.js texture
 */
export function imageUrlToTexture(url: string): THREE.Texture {
  return new THREE.TextureLoader().load(url);
}

/**
 * Dispose of a texture safely
 */
export function disposeTexture(texture: THREE.Texture | null): void {
  if (texture) {
    texture.dispose();
  }
}
