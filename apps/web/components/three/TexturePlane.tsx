/**
 * Three.js plane component that displays a texture
 */

'use client';

import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

interface TexturePlaneProps {
  texture: THREE.Texture | null;
  highlightColor?: [number, number, number] | null;
  highlightThreshold?: number;
}

export function TexturePlane({ 
  texture, 
  highlightColor = null,
  highlightThreshold = 0.1 
}: TexturePlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const previousTextureRef = useRef<THREE.Texture | null>(null);
  
  // Track texture image dimensions for aspect ratio calculation
  // Updated when texture image loads
  const [textureDimensions, setTextureDimensions] = useState<{ width: number; height: number } | null>(null);

  // Create shader material ONCE - only recreate if shader code needs to change
  // For now, we keep the same shader and update via uniforms only
  useEffect(() => {
    if (!meshRef.current || materialRef.current) return;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: texture },
        // SAFETY: Always provide a valid Vector3, never null
        // Use [0,0,0] when highlightColor is null to prevent shader errors
        uHighlightColor: { value: highlightColor ? new THREE.Vector3(...highlightColor) : new THREE.Vector3(0, 0, 0) },
        uHighlightThreshold: { value: highlightThreshold },
        uHighlightEnabled: { value: highlightColor !== null },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        uniform vec3 uHighlightColor;
        uniform float uHighlightThreshold;
        uniform bool uHighlightEnabled;
        varying vec2 vUv;

        void main() {
          vec4 texColor = texture2D(uTexture, vUv);
          
          if (uHighlightEnabled && uHighlightColor != vec3(0.0)) {
            // Calculate RGB distance
            vec3 diff = abs(texColor.rgb - uHighlightColor);
            float distance = length(diff);
            
            if (distance < uHighlightThreshold) {
              // Highlight: boost brightness
              texColor.rgb *= 1.5;
              texColor.a = 1.0;
            } else {
              // Dim non-highlighted pixels
              texColor.rgb *= 0.3;
              texColor.a = 0.5;
            }
          }
          
          gl_FragColor = texColor;
        }
      `,
      transparent: true,
    });

    if (meshRef.current) {
      meshRef.current.material = material;
      materialRef.current = material;
    }

    return () => {
      // Dispose material on unmount
      if (materialRef.current) {
        materialRef.current.dispose();
        materialRef.current = null;
      }
    };
  }, []); // Empty deps - create material once

  // Update texture uniform and dispose old texture
  // Also track when texture image loads to update plane geometry
  useEffect(() => {
    if (materialRef.current && texture) {
      // Dispose previous texture if it exists and is different
      if (previousTextureRef.current && previousTextureRef.current !== texture) {
        previousTextureRef.current.dispose();
      }
      
      materialRef.current.uniforms.uTexture.value = texture;
      materialRef.current.needsUpdate = true;
      previousTextureRef.current = texture;
      const textureImage = texture.image as { width?: number; height?: number } | undefined;
      
      // Check if texture image is already loaded
      const updateDimensions = () => {
        if (textureImage?.width && textureImage?.height) {
          setTextureDimensions({
            width: textureImage.width,
            height: textureImage.height,
          });
        }
      };
      
      // Check immediately
      updateDimensions();
      
      // If not loaded yet, wait for image to load
      if (texture.image && texture.image instanceof HTMLImageElement) {
        const img = texture.image;
        if (img.complete && img.naturalWidth > 0) {
          // Image already loaded
          updateDimensions();
        } else {
          // Wait for load event
          img.onload = updateDimensions;
          img.onerror = () => {
            // On error, use default dimensions
            setTextureDimensions(null);
          };
        }
      }
    } else {
      setTextureDimensions(null);
    }
  }, [texture]);

  // Update highlight uniforms (no material recreation needed)
  useEffect(() => {
    if (materialRef.current) {
      // SAFETY: Always provide a valid Vector3, never null
      // Use [0,0,0] when highlightColor is null to prevent shader errors
      if (materialRef.current.uniforms.uHighlightColor.value) {
        if (highlightColor) {
          materialRef.current.uniforms.uHighlightColor.value.set(...highlightColor);
        } else {
          materialRef.current.uniforms.uHighlightColor.value.set(0, 0, 0);
        }
      } else {
        materialRef.current.uniforms.uHighlightColor.value = highlightColor
          ? new THREE.Vector3(...highlightColor)
          : new THREE.Vector3(0, 0, 0);
      }
      materialRef.current.uniforms.uHighlightEnabled.value = highlightColor !== null;
      materialRef.current.needsUpdate = true;
    }
  }, [highlightColor]);

  // Update threshold uniform
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uHighlightThreshold.value = highlightThreshold;
      materialRef.current.needsUpdate = true;
    }
  }, [highlightThreshold]);

  // Calculate plane size to maintain aspect ratio
  // SAFETY: Use textureDimensions state which is updated when texture loads
  // Falls back to square (1:1) if texture not loaded yet
  const aspectRatio = textureDimensions
    ? textureDimensions.width / textureDimensions.height
    : 1;
  
  // Preserve aspect ratio: fit within a 10x10 unit square
  // If image is wider (aspectRatio > 1), constrain width to 10 and scale height
  // If image is taller (aspectRatio < 1), constrain height to 10 and scale width
  const maxSize = 10;
  let planeWidth: number;
  let planeHeight: number;
  
  if (aspectRatio >= 1) {
    // Wider or square: constrain width, scale height
    planeWidth = maxSize;
    planeHeight = maxSize / aspectRatio;
  } else {
    // Taller: constrain height, scale width
    planeHeight = maxSize;
    planeWidth = maxSize * aspectRatio;
  }

  // Use key to force React Three Fiber to recreate geometry when dimensions change
  // This ensures the plane updates when texture loads
  const geometryKey = textureDimensions 
    ? `${textureDimensions.width}x${textureDimensions.height}` 
    : 'default';

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <planeGeometry key={geometryKey} args={[planeWidth, planeHeight]} />
    </mesh>
  );
}
