import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const release=process.env.GITHUB_SHA??'development';
export default defineConfig({
  define:{'import.meta.env.VITE_RELEASE':JSON.stringify(release)},
  plugins:[react(),{name:'elsewhere-release',generateBundle(){this.emitFile({type:'asset',fileName:'release.json',source:JSON.stringify({commit:release,builtAt:new Date().toISOString()})});}}],
  base:process.env.GITHUB_ACTIONS ? '/Elsewhere/' : '/',
  build:{rollupOptions:{output:{manualChunks(id){
    if(id.includes('/three/')) return 'spatial';
    if(id.includes('/motion/')) return 'motion';
  }}}},
});
