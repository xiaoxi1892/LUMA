"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, HalfFloatType, ShaderMaterial, Vector3 } from "three";
import { GPUComputationRenderer, type Variable } from "three/addons/misc/GPUComputationRenderer.js";
import type { MatterWorld } from "@/lib/matter/types";
import { positionSimulation, velocitySimulation } from "@/shaders/particles/simulation";
import { particleVertex, particleFragment } from "@/shaders/particles/render";

interface Simulation { gpu: GPUComputationRenderer; position: Variable; velocity: Variable }
export default function ParticleField({ world, count }: { world: MatterWorld; count: number }) {
  const { gl } = useThree();
  const material = useRef<ShaderMaterial>(null);
  const simulation = useRef<Simulation | null>(null);
  const side = Math.ceil(Math.sqrt(count));
  const data = useMemo(() => {
    const position = new Float32Array(side * side * 3), reference = new Float32Array(side * side * 2), seed = new Float32Array(side * side);
    // Deterministic, evenly distributed material samples; no external texture assets.
    let state = 12481;
    const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    for (let i = 0; i < side * side; i++) {
      const y = random() * 2 - 1, angle = random() * Math.PI * 2, radius = Math.cbrt(random()) * 1.06;
      const ring = Math.sqrt(1 - y * y) * radius;
      position.set([Math.cos(angle) * ring, y * radius, Math.sin(angle) * ring], i * 3);
      reference.set([(i % side + .5) / side, (Math.floor(i / side) + .5) / side], i * 2);
      seed[i] = random();
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(position, 3));
    geometry.setAttribute("reference", new BufferAttribute(reference, 2));
    geometry.setAttribute("seed", new BufferAttribute(seed, 1));
    return { geometry, position, seed };
  }, [side]);
  const uniforms = useMemo(() => ({
    uPositions: { value: null }, uUseSimulation: { value: 0 }, uTime: { value: 0 },
    uField: { value: 0 }, uCharge: { value: 0 }, uBloom: { value: 0 }, uPixelRatio: { value: 1 },
    uViewportHeight: { value: 1000 }, uDown: { value: 0 }, uSpeed: { value: 0 }, uPointer: { value: new Vector3(20, 20, 0) },
  }), []);

  useEffect(() => {
    if (!gl.extensions.has("EXT_color_buffer_float") || !gl.capabilities.maxVertexTextures) return;
    const gpu = new GPUComputationRenderer(side, side, gl);
    gpu.setDataType(HalfFloatType);
    const home = gpu.createTexture(), initial = gpu.createTexture(), velocityTexture = gpu.createTexture();
    for (let i = 0; i < side * side; i++) {
      for (let axis = 0; axis < 3; axis++) {
        home.image.data[i * 4 + axis] = data.position[i * 3 + axis];
        initial.image.data[i * 4 + axis] = data.position[i * 3 + axis] * [4.2, 2.8, 2.5][axis];
      }
      home.image.data[i * 4 + 3] = initial.image.data[i * 4 + 3] = data.seed[i];
    }
    const position = gpu.addVariable("texturePosition", positionSimulation, initial);
    const velocity = gpu.addVariable("textureVelocity", velocitySimulation, velocityTexture);
    gpu.setVariableDependencies(position, [position, velocity]);
    gpu.setVariableDependencies(velocity, [position, velocity]);
    for (const variable of [position, velocity]) Object.assign(variable.material.uniforms, {
      uHome: { value: home }, uDelta: { value: 1 / 60 }, uTime: { value: 0 }, uMotion: { value: 1 },
      uField: { value: 0 }, uCharge: { value: 0 }, uBloom: { value: 0 }, uDown: { value: 0 },
      uSpeed: { value: 0 }, uPointer: { value: new Vector3(20, 20, 0) },
    });
    const error = gpu.init();
    if (!error) simulation.current = { gpu, position, velocity };
    return () => { simulation.current = null; gpu.dispose(); home.dispose(); };
  }, [data, gl, side]);

  useFrame(({ size }, delta) => {
    if (!material.current || document.hidden) return;
    const age = world.time - world.secretStart;
    const secret = age > .1 && age < 3 ? Math.sin(Math.min(1, (age - .1) / .35) * Math.PI / 2) * Math.exp(-Math.max(0, age - .5) * 1.5) : 0;
    const bloom = Math.max(world.bloom, secret);
    const sim = simulation.current;
    if (sim) {
      for (const variable of [sim.position, sim.velocity]) {
        const u = variable.material.uniforms;
        u.uDelta.value = Math.min(delta, .033); u.uTime.value = world.time;
        u.uField.value = world.fieldMix; u.uCharge.value = world.charge; u.uBloom.value = bloom;
        u.uDown.value = world.down ? 1 : 0; u.uPointer.value.copy(world.pointer);
        u.uSpeed.value = world.pointerVelocity.length(); u.uMotion.value = world.reducedMotion ? .1 : 1;
      }
      if (age < 0 || age >= .1) sim.gpu.compute();
    }
    const u = material.current.uniforms;
    u.uUseSimulation.value = sim ? 1 : 0;
    if (sim) u.uPositions.value = sim.gpu.getCurrentRenderTarget(sim.position).texture;
    u.uTime.value = world.time; u.uField.value = world.fieldMix; u.uCharge.value = world.charge;
    u.uBloom.value = bloom; u.uDown.value = world.down ? 1 : 0; u.uPointer.value.copy(world.pointer);
    u.uSpeed.value = world.pointerVelocity.length(); u.uPixelRatio.value = gl.getPixelRatio();
    u.uViewportHeight.value = size.height * gl.getPixelRatio();
    data.geometry.setDrawRange(0, count);
  }, -5);
  return <points geometry={data.geometry} frustumCulled={false} renderOrder={1}>
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={particleVertex} fragmentShader={particleFragment}
      transparent depthWrite={false} depthTest blending={AdditiveBlending} />
  </points>;
}
