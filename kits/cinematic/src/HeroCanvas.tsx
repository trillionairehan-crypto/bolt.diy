import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * 히어로 WebGL 레이어 — 히어로 사진 1장을 전면 평면에 올리고, 심플렉스 노이즈로 미세하게 일렁이게 하며
 * 마우스에 따라 살짝 패럴랙스 + 필름 그레인 + 비네트. three + R3F만 쓴다(drei 없음 — 번들 예산).
 * 데스크톱·reduced-motion 아님·WebGL 가능할 때만 마운트한다(HeroScene이 판단).
 */

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D uTexture;
uniform vec2 uPlane;
uniform vec2 uImage;
uniform vec2 uMouse;
uniform float uTime;
uniform float uStrength;
varying vec2 vUv;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

vec2 coverUv(vec2 uv) {
  float planeAspect = uPlane.x / uPlane.y;
  float imageAspect = uImage.x / uImage.y;
  vec2 scale = planeAspect > imageAspect ? vec2(1.0, imageAspect / planeAspect) : vec2(planeAspect / imageAspect, 1.0);
  return (uv - 0.5) * scale + 0.5;
}

void main() {
  vec2 uv = coverUv(vUv);
  // 마우스 패럴랙스: 화면 중심 대비 ±1.2%
  uv += (uMouse - 0.5) * 0.024;
  // 노이즈 일렁임: 아주 느리고 얕게 (물·열기 느낌, 사진이 망가지지 않는 선)
  float n = snoise(uv * 3.0 + uTime * 0.08);
  uv += vec2(n, snoise(uv * 3.0 - uTime * 0.06)) * 0.006 * uStrength;
  vec3 color = texture2D(uTexture, uv).rgb;
  // 필름 그레인
  float grain = (fract(sin(dot(vUv * uTime, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.06;
  color += grain;
  // 비네트
  float d = distance(vUv, vec2(0.5));
  color *= smoothstep(0.95, 0.35, d) * 0.35 + 0.65;
  gl_FragColor = vec4(color, 1.0);
}
`;

function Plane({ src, strength }: { src: string; strength: number }) {
  const texture = useLoader(THREE.TextureLoader, src);
  const { size } = useThree();
  const material = useRef<THREE.ShaderMaterial>(null);
  const mouse = useRef(new THREE.Vector2(0.5, 0.5));
  const target = useRef(new THREE.Vector2(0.5, 0.5));

  const uniforms = useMemo(
    () => ({
      uTexture: { value: texture },
      uPlane: { value: new THREE.Vector2(size.width, size.height) },
      uImage: { value: new THREE.Vector2(texture.image.width, texture.image.height) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uTime: { value: 0 },
      uStrength: { value: strength },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [texture],
  );

  useFrame((state, delta) => {
    const mat = material.current;

    if (!mat) {
      return;
    }

    target.current.set(state.pointer.x * 0.5 + 0.5, state.pointer.y * 0.5 + 0.5);
    mouse.current.lerp(target.current, Math.min(1, delta * 2.5));
    mat.uniforms.uMouse.value.copy(mouse.current);
    mat.uniforms.uTime.value += delta;
    mat.uniforms.uPlane.value.set(state.size.width, state.size.height);
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={material} vertexShader={VERTEX} fragmentShader={FRAGMENT} uniforms={uniforms} />
    </mesh>
  );
}

export interface HeroCanvasProps {
  src: string;
  /** 0 = 일렁임 없음(그레인·패럴랙스만), 1 = 기본. */
  strength?: number;
}

export default function HeroCanvas({ src, strength = 1 }: HeroCanvasProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0 }}
      orthographic
      camera={{ position: [0, 0, 1], near: 0, far: 2 }}
    >
      <Plane src={src} strength={strength} />
    </Canvas>
  );
}
