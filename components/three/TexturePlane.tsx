/**
 * Three.js plane component that displays a texture
 */

'use client';

import { useRef, useEffect } from 'react';
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

  // Create shader material ONCE - only recreate if shader code needs to change
  // For now, we keep the same shader and update via uniforms only
  useEffect(() => {
    if (!meshRef.current || materialRef.current) return;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: texture },
        uHighlightColor: { value: highlightColor ? new THREE.Vector3(...highlightColor) : null },
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
  useEffect(() => {
    if (materialRef.current && texture) {
      // Dispose previous texture if it exists and is different
      if (previousTextureRef.current && previousTextureRef.current !== texture) {
        previousTextureRef.current.dispose();
      }
      
      materialRef.current.uniforms.uTexture.value = texture;
      materialRef.current.needsUpdate = true;
      previousTextureRef.current = texture;
    }
  }, [texture]);

  // Update highlight uniforms (no material recreation needed)
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uHighlightColor.value = highlightColor
        ? new THREE.Vector3(...highlightColor)
        : null;
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
  const aspectRatio = texture ? texture.image.width / texture.image.height : 1;
  const planeWidth = Math.min(10, 10 * aspectRatio);
  const planeHeight = Math.min(10, 10 / aspectRatio);

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <planeGeometry args={[planeWidth, planeHeight]} />
    </mesh>
  );
}
