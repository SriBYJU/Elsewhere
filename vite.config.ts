import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],base:process.env.GITHUB_ACTIONS ? '/Elsewhere/' : '/',build:{rollupOptions:{output:{manualChunks:{spatial:['three'],motion:['motion/react']}}}}});
