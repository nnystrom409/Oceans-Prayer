"use client";

import { useEffect, useMemo, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";

/**
 * FXAA post-processing effects for smoother edges.
 * Helps eliminate triangle seams and jagged lines.
 */
export function Effects() {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<EffectComposer | null>(null);

  const composer = useMemo(() => {
    const effectComposer = new EffectComposer(gl);

    // Main scene render pass
    const renderPass = new RenderPass(scene, camera);
    effectComposer.addPass(renderPass);

    // FXAA anti-aliasing pass
    const fxaaPass = new ShaderPass(FXAAShader);
    const pixelRatio = gl.getPixelRatio();
    fxaaPass.material.uniforms["resolution"].value.set(
      1 / (size.width * pixelRatio),
      1 / (size.height * pixelRatio)
    );
    effectComposer.addPass(fxaaPass);

    composerRef.current = effectComposer;
    return effectComposer;
  }, [gl, scene, camera, size]);

  // Update resolution when size changes
  useEffect(() => {
    if (composerRef.current) {
      composerRef.current.setSize(size.width, size.height);

      // Update FXAA resolution uniform
      const fxaaPass = composerRef.current.passes[1] as ShaderPass;
      if (fxaaPass?.material?.uniforms?.["resolution"]) {
        const pixelRatio = gl.getPixelRatio();
        fxaaPass.material.uniforms["resolution"].value.set(
          1 / (size.width * pixelRatio),
          1 / (size.height * pixelRatio)
        );
      }
    }
  }, [size, gl]);

  // Render using the composer instead of default renderer
  // Priority 1 ensures this runs after scene updates
  // Return true to prevent default R3F render
  useFrame(({ gl }) => {
    if (composerRef.current) {
      gl.autoClear = false;
      composerRef.current.render();
    }
  }, 1);

  return null;
}
