import { useRef, useMemo, useCallback, useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

// Shader material for rendering country IDs as colors
const pickingVertexShader = `
  attribute float countryId;
  varying float vCountryId;

  void main() {
    vCountryId = countryId;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const pickingFragmentShader = `
  varying float vCountryId;

  void main() {
    // Encode country ID as RGB color
    // ID 0 = no country (ocean), IDs 1-65535 = valid countries
    float id = vCountryId;
    float r = mod(id, 256.0) / 255.0;
    float g = mod(floor(id / 256.0), 256.0) / 255.0;
    gl_FragColor = vec4(r, g, 0.0, 1.0);
  }
`;

export interface GpuPickerResult {
  countryIndex: number | null; // null means ocean/no country
}

interface UseGpuPickerOptions {
  pickingGeometry: THREE.BufferGeometry | null;
  globeGroupRef?: React.RefObject<THREE.Group | null>;
}

export function useGpuPicker({ pickingGeometry, globeGroupRef }: UseGpuPickerOptions) {
  const { gl, camera, size } = useThree();

  // 1x1 render target for reading single pixel
  const renderTarget = useMemo(() => {
    return new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });
  }, []);

  // Picking material
  const pickingMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: pickingVertexShader,
      fragmentShader: pickingFragmentShader,
      side: THREE.FrontSide,
    });
  }, []);

  // Picking mesh - created when geometry is available
  const pickingMesh = useMemo(() => {
    if (!pickingGeometry) return null;
    return new THREE.Mesh(pickingGeometry, pickingMaterial);
  }, [pickingGeometry, pickingMaterial]);

  // Picking scene
  const pickingScene = useMemo(() => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Black = ID 0 = ocean
    return scene;
  }, []);

  // Add/remove mesh from picking scene when it changes (must be in useEffect, not during render)
  useEffect(() => {
    if (pickingMesh) {
      pickingScene.add(pickingMesh);
    }
    return () => {
      if (pickingMesh) {
        pickingScene.remove(pickingMesh);
      }
    };
  }, [pickingMesh, pickingScene]);

  // Pixel buffer for reading
  const pixelBuffer = useRef(new Uint8Array(4));

  // Pick country at screen coordinates
  const pick = useCallback(
    (screenX: number, screenY: number): GpuPickerResult => {
      if (!pickingMesh) {
        return { countryIndex: null };
      }

      // Sync picking mesh rotation with globe group (if provided)
      if (globeGroupRef?.current) {
        pickingMesh.rotation.copy(globeGroupRef.current.rotation);
        pickingMesh.updateMatrixWorld();
      }

      // Convert screen coordinates to normalized device coordinates
      // Note: Three.js uses bottom-left origin, DOM uses top-left
      const ndcX = (screenX / size.width) * 2 - 1;
      const ndcY = -(screenY / size.height) * 2 + 1;

      // Save current camera state
      const originalMatrix = camera.projectionMatrix.clone();

      // Use setViewOffset to render only the pixel under cursor
      // This makes the camera render a 1x1 region of the viewport
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.setViewOffset(
          size.width,
          size.height,
          screenX - 0.5,
          screenY - 0.5,
          1,
          1
        );
        camera.updateProjectionMatrix();
      }

      // Render picking scene to 1x1 target
      gl.setRenderTarget(renderTarget);
      gl.clear();
      gl.render(pickingScene, camera);

      // Read the pixel
      gl.readRenderTargetPixels(renderTarget, 0, 0, 1, 1, pixelBuffer.current);

      // Restore camera
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.clearViewOffset();
        camera.updateProjectionMatrix();
      }

      // Reset render target
      gl.setRenderTarget(null);

      // Decode country ID from RGB
      const r = pixelBuffer.current[0];
      const g = pixelBuffer.current[1];
      const countryId = r + g * 256;

      // ID 0 means ocean (black background)
      if (countryId === 0) {
        return { countryIndex: null };
      }

      // IDs are 1-indexed, so subtract 1 to get array index
      return { countryIndex: countryId - 1 };
    },
    [camera, gl, globeGroupRef, pickingMesh, pickingScene, renderTarget, size]
  );

  return { pick };
}
