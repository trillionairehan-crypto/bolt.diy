import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@kit': fileURLToPath(new URL('../src', import.meta.url)) },
  },
  server: {
    fs: { allow: ['..'] },
    /*
     * R2 공개 버킷(pub-*.r2.dev)은 Access-Control-Allow-Origin을 안 보낸다 — 그 상태로는 WebGL 텍스처로 못 쓴다
     * (crossOrigin 요청이 막혀 히어로 셰이더가 통째로 실패). 데모는 같은 오리진으로 프록시해서 실제 운영 조건
     * (미디어를 사이트 오리진 또는 CORS 규칙이 붙은 버킷에서 받는 상태)을 재현한다.
     */
    proxy: {
      '/r2': {
        target: 'https://pub-b08f99b5ccf040e4b6b0293f2d95f744.r2.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/r2/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // three 계열은 히어로 WebGL에서만 쓰므로 별도 청크 — 모바일 폴백 경로는 이 청크를 안 받는다.
        manualChunks: { three: ['three', '@react-three/fiber'] },
      },
    },
  },
});
