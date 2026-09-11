import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@kit': fileURLToPath(new URL('../src', import.meta.url)) },
  },
  server: { fs: { allow: ['..'] } },
  build: {
    rollupOptions: {
      output: {
        // three 계열은 히어로 WebGL에서만 쓰므로 별도 청크 — 모바일 폴백 경로는 이 청크를 안 받는다.
        manualChunks: { three: ['three', '@react-three/fiber'] },
      },
    },
  },
});
