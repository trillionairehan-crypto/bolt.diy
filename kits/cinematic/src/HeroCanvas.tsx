import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * 히어로 WebGL 레이어 — 히어로 미디어(사진 또는 무음 루프 영상)를 전면 평면에 올리고, 심플렉스 노이즈로 미세하게
 * 일렁이게 하며 마우스에 따라 살짝 패럴랙스 + 필름 그레인 + 비네트. three + R3F만 쓴다(drei 없음 — 번들 예산).
 * 영상이 주어지면 VideoTexture로 같은 셰이더를 통과시킨다 — 디코드 전이거나 코덱이 없으면 포스터 사진으로 계속 돈다.
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

/** 무음 루프 영상 → VideoTexture. 디코드에 실패하면 null을 유지해 포스터 사진 텍스처가 그대로 남는다. */
function useVideoTexture(url?: string): THREE.VideoTexture | null {
  const [texture, setTexture] = useState<THREE.VideoTexture | null>(null);

  useEffect(() => {
    if (!url) {
      return;
    }

    const el = document.createElement('video');
    el.src = url;
    el.muted = true;
    el.loop = true;
    el.playsInline = true;
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';

    let made: THREE.VideoTexture | null = null;
    const onReady = () => {
      if (made || !el.videoWidth) {
        return;
      }

      made = new THREE.VideoTexture(el);
      setTexture(made);
    };

    el.addEventListener('loadeddata', onReady);
    el.addEventListener('playing', onReady);
    el.play().catch(() => undefined);

    return () => {
      el.removeEventListener('loadeddata', onReady);
      el.removeEventListener('playing', onReady);
      el.pause();
      el.removeAttribute('src');
      el.load();
      made?.dispose();
    };
  }, [url]);

  return texture;
}

function Plane({ texture, video, strength }: { texture: THREE.Texture; video?: string; strength: number }) {
  const videoTexture = useVideoTexture(video);
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

  useEffect(() => {
    const mat = material.current;

    if (!mat || !videoTexture) {
      return;
    }

    const el = videoTexture.image as HTMLVideoElement;
    mat.uniforms.uTexture.value = videoTexture;
    mat.uniforms.uImage.value.set(el.videoWidth, el.videoHeight);
  }, [videoTexture]);

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
  /** 포스터 사진 — 영상이 없거나 아직 디코드 전이면 이게 보인다. */
  src: string;
  /** 무음 루프 영상. 주면 같은 셰이더에 VideoTexture로 들어간다. */
  video?: string;
  /** 0 = 일렁임 없음(그레인·패럴랙스만), 1 = 기본. */
  strength?: number;
  /** 포스터 텍스처 로드 실패(대개 CORS). 호출 쪽이 영상·이미지 폴백으로 내려가야 한다. */
  onError?: () => void;
}

export default function HeroCanvas({ src, video, strength = 1, onError }: HeroCanvasProps) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  // 포스터 텍스처는 직접 로드한다(useLoader의 서스펜스 throw는 실패 시 트리 전체를 날린다).
  // 크로스 오리진 이미지에 CORS 헤더가 없으면 WebGL 텍스처로 못 쓰므로 그 땐 onError로 히어로를 <video>/<img>에 넘긴다.
  useEffect(() => {
    let dead = false;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    loader.load(
      src,
      (loaded) => {
        if (dead) {
          loaded.dispose();
          return;
        }

        setTexture(loaded);
      },
      undefined,
      () => {
        if (!dead) {
          onError?.();
        }
      },
    );

    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  if (!texture) {
    return null;
  }

  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0 }}
      orthographic
      camera={{ position: [0, 0, 1], near: 0, far: 2 }}
    >
      <Plane texture={texture} video={video} strength={strength} />
    </Canvas>
  );
}
