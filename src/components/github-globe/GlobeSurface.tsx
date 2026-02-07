"use client";

import { useEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

interface GlobeSurfaceProps {
  radius?: number;
  selectedId?: number | null;
  landUrl?: string;
  bordersUrl?: string;
  idMapUrl?: string;
}

const highlightVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const highlightFragmentShader = `
  uniform sampler2D idMap;
  uniform float selectedId;
  uniform vec3 selectedColor;
  uniform float selectedOpacity;
  varying vec2 vUv;

  void main() {
    vec4 idColor = texture2D(idMap, vUv);

    float r = floor(idColor.r * 255.0 + 0.5);
    float g = floor(idColor.g * 255.0 + 0.5);
    float id = r + g * 256.0;

    if (id < 0.5) {
      discard;
    }

    float isSelected = step(0.5, 1.0 - abs(id - selectedId));

    if (isSelected > 0.5) {
      gl_FragColor = vec4(selectedColor, selectedOpacity);
      return;
    }

    discard;
  }
`;

export function GlobeSurface({
  radius = 1,
  selectedId = null,
  landUrl = "/globe/earth-land.png",
  bordersUrl = "/globe/earth-borders.png",
  idMapUrl = "/globe/country-id.png",
}: GlobeSurfaceProps) {
  const [landTexture, bordersTexture, idTexture] = useTexture([
    landUrl,
    bordersUrl,
    idMapUrl,
  ]);

  useEffect(() => {
    landTexture.colorSpace = THREE.SRGBColorSpace;
    landTexture.wrapS = THREE.ClampToEdgeWrapping;
    landTexture.wrapT = THREE.ClampToEdgeWrapping;
    landTexture.needsUpdate = true;

    bordersTexture.colorSpace = THREE.SRGBColorSpace;
    bordersTexture.wrapS = THREE.ClampToEdgeWrapping;
    bordersTexture.wrapT = THREE.ClampToEdgeWrapping;
    bordersTexture.needsUpdate = true;

    idTexture.colorSpace = THREE.NoColorSpace;
    idTexture.wrapS = THREE.ClampToEdgeWrapping;
    idTexture.wrapT = THREE.ClampToEdgeWrapping;
    idTexture.minFilter = THREE.NearestFilter;
    idTexture.magFilter = THREE.NearestFilter;
    idTexture.generateMipmaps = false;
    idTexture.needsUpdate = true;
  }, [landTexture, bordersTexture, idTexture]);

  const oceanMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#6f9fdc"),
        emissive: new THREE.Color("#6f9fdc"),
        emissiveIntensity: 0.3,
        roughness: 0.9,
        metalness: 0.0,
        toneMapped: false,
      }),
    []
  );

  const landMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#ffffff"),
        emissive: new THREE.Color("#ffffff"),
        emissiveIntensity: 0.2,
        map: landTexture,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    [landTexture]
  );

  const bordersMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: bordersTexture,
        transparent: true,
        depthWrite: false,
        opacity: 0.8,
      }),
    [bordersTexture]
  );

  const highlightMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: highlightVertexShader,
        fragmentShader: highlightFragmentShader,
        uniforms: {
          idMap: { value: idTexture },
          selectedId: { value: selectedId ?? -1 },
          selectedColor: { value: new THREE.Color("#bae6fd") },
          selectedOpacity: { value: 0.85 },
        },
        transparent: true,
        depthWrite: false,
      }),
    [idTexture]
  );

  useEffect(() => {
    highlightMaterial.uniforms.selectedId.value = selectedId ?? -1;
  }, [highlightMaterial, selectedId]);

  return (
    <group>
      <mesh>
        <sphereGeometry args={[radius, 64, 64]} />
        <primitive object={oceanMaterial} attach="material" />
      </mesh>

      <mesh>
        <sphereGeometry args={[radius * 1.001, 64, 64]} />
        <primitive object={landMaterial} attach="material" />
      </mesh>

      <mesh>
        <sphereGeometry args={[radius * 1.002, 64, 64]} />
        <primitive object={bordersMaterial} attach="material" />
      </mesh>

      <mesh>
        <sphereGeometry args={[radius * 1.003, 64, 64]} />
        <primitive object={highlightMaterial} attach="material" />
      </mesh>
    </group>
  );
}
