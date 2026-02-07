"use client";

import { useMemo } from "react";
import * as THREE from "three";

// Custom shader for thick glossy glass bubble globe
const globeVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const globeFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  uniform vec3 baseColor;
  uniform vec3 edgeColor;
  uniform vec3 rimColor;

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float NdotV = max(dot(viewDirection, vNormal), 0.0);

    // Start with solid base fill color (soft blue-gray)
    vec3 color = baseColor;

    // Outer edge fresnel - thick glass edge effect
    float outerFresnel = pow(1.0 - NdotV, 2.5);
    color = mix(color, edgeColor, outerFresnel * 0.85);

    // Inner rim for depth illusion - creates sense of thickness
    float rimLight = pow(1.0 - NdotV, 1.5) * 0.35;
    color += rimColor * rimLight;

    // Gradient from edge to center for additional depth
    float depthGradient = smoothstep(0.0, 0.6, NdotV);
    color = mix(color, baseColor * 1.1, depthGradient * 0.3);

    // Tighter specular highlights (higher exponent = tighter)
    vec3 lightDir1 = normalize(vec3(4.0, 4.0, 5.0));
    vec3 lightDir2 = normalize(vec3(-3.0, 5.0, 3.0));
    vec3 lightDir3 = normalize(vec3(0.0, 6.0, 2.0)); // Top light for vertical highlight

    vec3 halfVector1 = normalize(lightDir1 + viewDirection);
    vec3 halfVector2 = normalize(lightDir2 + viewDirection);
    vec3 halfVector3 = normalize(lightDir3 + viewDirection);

    // Dual-layer speculars: tight core + broader glow
    // Tight highlights for glass sharpness
    float specTight1 = pow(max(dot(vNormal, halfVector1), 0.0), 64.0);
    float specTight2 = pow(max(dot(vNormal, halfVector2), 0.0), 80.0);
    float specTight3 = pow(max(dot(vNormal, halfVector3), 0.0), 56.0);

    // Broader highlights for visible glossy glow
    float specBroad1 = pow(max(dot(vNormal, halfVector1), 0.0), 16.0);
    float specBroad2 = pow(max(dot(vNormal, halfVector2), 0.0), 20.0);
    float specBroad3 = pow(max(dot(vNormal, halfVector3), 0.0), 14.0);

    // Combine: bright tight cores + softer broad halos
    vec3 specularTint = vec3(0.95, 0.98, 1.0);
    vec3 tightSpec = vec3(1.0) * (specTight1 * 0.8 + specTight2 * 0.5 + specTight3 * 0.6);
    vec3 broadSpec = specularTint * (specBroad1 * 0.25 + specBroad2 * 0.15 + specBroad3 * 0.2);
    color += tightSpec + broadSpec;

    // Subtle ambient reflection on edges
    float ambientReflect = outerFresnel * 0.15;
    color += vec3(0.8, 0.9, 1.0) * ambientReflect;

    // Subtle dark rim at very edge for "glass wall" effect
    float sharpRim = pow(1.0 - NdotV, 6.0);
    vec3 darkRimColor = vec3(0.35, 0.50, 0.58);
    color = mix(color, darkRimColor, sharpRim * 0.35);

    // Caustic pattern from world position
    float caustic1 = sin(vWorldPosition.x * 10.0 + vWorldPosition.y * 8.0) * 0.5 + 0.5;
    float caustic2 = sin(vWorldPosition.y * 9.0 + vWorldPosition.z * 11.0) * 0.5 + 0.5;
    float caustic3 = sin(vWorldPosition.z * 7.0 + vWorldPosition.x * 12.0) * 0.5 + 0.5;
    float caustic = caustic1 * caustic2 * caustic3;

    // Only in center areas, very subtle
    float causticMask = smoothstep(0.2, 0.7, NdotV);
    color += vec3(0.02, 0.03, 0.04) * caustic * causticMask;

    // Fully opaque - no transparency through the globe
    gl_FragColor = vec4(color, 1.0);
  }
`;

interface GlobeSphereProps {
  radius?: number;
}

export function GlobeSphere({ radius = 1 }: GlobeSphereProps) {
  const uniforms = useMemo(
    () => ({
      baseColor: { value: new THREE.Color("#5b9ec9") }, // Vibrant ocean blue
      edgeColor: { value: new THREE.Color("#3a7ca5") }, // Deeper blue edges
      rimColor: { value: new THREE.Color("#2d6a8f") }, // Deep blue for inner rim
    }),
    []
  );

  return (
    <mesh>
      <sphereGeometry args={[radius, 128, 128]} />
      <shaderMaterial
        vertexShader={globeVertexShader}
        fragmentShader={globeFragmentShader}
        uniforms={uniforms}
        transparent={false}
        side={THREE.FrontSide}
        depthWrite={true}
      />
    </mesh>
  );
}
