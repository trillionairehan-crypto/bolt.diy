import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * 3D 쇼케이스 실장면 — 드래그로 돌리는 오브젝트 1점. R3F + three만 쓴다(drei 없음 — 번들 예산).
 * 조명은 RoomEnvironment PMREM(외부 HDR 다운로드 없음) + 키 라이트 1개. 이 파일은 lazy 청크라
 * 데스크톱·WebGL·뷰포트 접근 시에만 내려온다.
 */

/** 회전축 단면(반지름, 높이). 물레로 뽑듯 LatheGeometry로 돌린다. */
const PROFILES: Record<string, [number, number][]> = {
  // 소금 단지 — 넓은 몸통, 좁은 목, 살짝 벌어진 림
  jar: [
    [0.0, -1.0],
    [0.46, -1.0],
    [0.56, -0.96],
    [0.68, -0.78],
    [0.73, -0.45],
    [0.72, -0.1],
    [0.66, 0.25],
    [0.54, 0.52],
    [0.41, 0.68],
    [0.35, 0.76],
    [0.38, 0.84],
    [0.36, 0.87],
    [0.33, 0.83],
    [0.31, 0.7],
    [0.3, 0.2],
  ],
  // 얕은 접시 — 빵·제품을 올리는 쪽
  bowl: [
    [0.0, -0.45],
    [0.34, -0.45],
    [0.5, -0.4],
    [0.78, -0.2],
    [0.96, 0.08],
    [1.0, 0.16],
    [0.97, 0.19],
    [0.9, 0.1],
    [0.72, -0.12],
    [0.46, -0.3],
    [0.0, -0.34],
  ],
};

function useRoomEnvironment() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const target = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = target.texture;

    return () => {
      scene.environment = null;
      target.texture.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
}

/** 바닥 접지 그림자 — 방사형 그라데이션 캔버스 텍스처 한 장(지오메트리 그림자 연산 없음). */
function useShadowTexture(): THREE.Texture {
  return useMemo(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(0,0,0,0.55)');
    gradient.addColorStop(0.55, 'rgba(0,0,0,0.18)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
  }, []);
}

interface StageProps {
  shape: keyof typeof PROFILES;
  color: string;
  accent: string;
  /** 손을 떼면 도는 속도(rad/s). 0이면 정지. */
  spin: number;
  onFirstFrame?: () => void;
}

function Stage({ shape, color, accent, spin, onFirstFrame }: StageProps) {
  const group = useRef<THREE.Group>(null);
  const velocity = useRef(0);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const announced = useRef(false);
  const gl = useThree((state) => state.gl);
  const shadow = useShadowTexture();

  useRoomEnvironment();

  const geometry = useMemo(() => {
    // 단면을 스플라인으로 한 번 더 촘촘히 — 점이 성기면 실루엣에 각이 진다.
    const curve = new THREE.SplineCurve(PROFILES[shape].map(([x, y]) => new THREE.Vector2(x, y)));
    const points = curve.getPoints(120).map((point) => new THREE.Vector2(Math.max(0, point.x), point.y));

    return new THREE.LatheGeometry(points, 192);
  }, [shape]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  // 드래그 회전 + 관성. 포인터는 캔버스 전체에서 받는다(오브젝트를 정확히 집지 않아도 돌아간다).
  useEffect(() => {
    const el = gl.domElement;
    el.style.cursor = 'grab';
    el.style.touchAction = 'pan-y';

    const down = (event: PointerEvent) => {
      dragging.current = true;
      lastX.current = event.clientX;
      el.style.cursor = 'grabbing';
      el.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!dragging.current) {
        return;
      }

      velocity.current += (event.clientX - lastX.current) * 0.004;
      lastX.current = event.clientX;
    };
    const up = (event: PointerEvent) => {
      dragging.current = false;
      el.style.cursor = 'grab';

      try {
        el.releasePointerCapture(event.pointerId);
      } catch {
        // 캡처가 이미 풀린 경우
      }
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);

    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('pointerleave', up);
    };
  }, [gl]);

  useFrame((state, delta) => {
    const node = group.current;

    if (!node) {
      return;
    }

    node.rotation.y += velocity.current + (dragging.current ? 0 : spin * delta);
    velocity.current *= 1 - Math.min(1, delta * 4.2);
    node.position.y = Math.sin(state.clock.elapsedTime * 0.7) * 0.035;
    node.rotation.z = Math.sin(state.clock.elapsedTime * 0.45) * 0.012;

    if (!announced.current) {
      announced.current = true;
      onFirstFrame?.();
    }
  });

  return (
    <>
      <ambientLight intensity={0.12} />
      {/* 키 라이트는 한쪽에서 — 흰 도자기가 배경과 붙지 않도록 몸통에 명암을 만든다 */}
      <directionalLight position={[3.4, 2.6, 2.4]} intensity={1.35} />
      <directionalLight position={[-3.2, 1.0, -1.6]} intensity={0.55} color={accent} />

      <group ref={group}>
        <mesh geometry={geometry} castShadow={false}>
          <meshPhysicalMaterial
            color={color}
            roughness={0.58}
            metalness={0.02}
            clearcoat={0.3}
            clearcoatRoughness={0.45}
            envMapIntensity={0.42}
            side={THREE.DoubleSide}
          />
        </mesh>
        {shape === 'jar' ? (
          <mesh position={[0, 0.62, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.47, 0.018, 24, 160]} />
            {/* 금속 반사는 흰 RoomEnvironment를 그대로 비춰 회색이 된다 — 액센트 색이 보이게 metalness를 낮춘다 */}
            <meshStandardMaterial color={accent} roughness={0.34} metalness={0.18} envMapIntensity={0.5} />
          </mesh>
        ) : null}
      </group>

      <mesh position={[0, -1.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.4, 3.4]} />
        <meshBasicMaterial map={shadow} transparent opacity={0.75} depthWrite={false} />
      </mesh>
    </>
  );
}

export interface Showcase3DSceneProps {
  shape?: keyof typeof PROFILES;
  color?: string;
  accent?: string;
  spin?: number;
  onFirstFrame?: () => void;
}

export default function Showcase3DScene({
  shape = 'jar',
  color = '#cdb99b',
  accent = '#ff5330',
  spin = 0.22,
  onFirstFrame,
}: Showcase3DSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0.35, 4.1], fov: 34 }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Stage shape={shape} color={color} accent={accent} spin={spin} onFirstFrame={onFirstFrame} />
    </Canvas>
  );
}
