/**
 * Main Three.js canvas component for blueprint preview
 */

'use client';

import { Suspense, useMemo, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { TexturePlane } from './TexturePlane';
import * as THREE from 'three';
import { base64ToTexture, imageUrlToTexture } from '@/lib/preview/texture';

interface BlueprintCanvasProps {
  previewBase64: string | null;
  originalImageUrl: string | null;
  highlightColor: [number, number, number] | null;
  highlightThreshold: number;
}

export function BlueprintCanvas({
  previewBase64,
  originalImageUrl,
  highlightColor,
  highlightThreshold,
}: BlueprintCanvasProps) {
  const previousTextureRef = useRef<THREE.Texture | null>(null);

  // Create texture from preview or original image
  // Dispose previous texture when it changes
  const texture = useMemo(() => {
    // Dispose previous texture before creating new one
    if (previousTextureRef.current) {
      previousTextureRef.current.dispose();
      previousTextureRef.current = null;
    }

    let newTexture: THREE.Texture | null = null;
    
    if (previewBase64) {
      newTexture = base64ToTexture(previewBase64, {
        magFilter: THREE.NearestFilter,
        minFilter: THREE.NearestFilter,
        generateMipmaps: false,
      });
    } else if (originalImageUrl) {
      newTexture = imageUrlToTexture(originalImageUrl);
    }

    if (newTexture) {
      previousTextureRef.current = newTexture;
    }

    return newTexture;
  }, [previewBase64, originalImageUrl]);

  // Cleanup texture on unmount
  useEffect(() => {
    return () => {
      if (previousTextureRef.current) {
        previousTextureRef.current.dispose();
        previousTextureRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full h-full bg-black">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={1} />
          <pointLight position={[10, 10, 10]} intensity={0.5} />
          
          {/* Subtle grid background */}
          <Grid
            args={[20, 20]}
            cellColor="#333333"
            sectionColor="#222222"
            cellThickness={0.5}
            sectionThickness={1}
            fadeDistance={15}
            fadeStrength={0.5}
            position={[0, 0, -0.1]}
          />
          
          {/* Texture plane */}
          {texture && (
            <TexturePlane
              texture={texture}
              highlightColor={highlightColor}
              highlightThreshold={highlightThreshold}
            />
          )}
          
          {/* Orbit controls for zoom/pan */}
          <OrbitControls
            enableZoom={true}
            enablePan={true}
            enableRotate={false}
            minDistance={2}
            maxDistance={20}
            zoomSpeed={0.8}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
