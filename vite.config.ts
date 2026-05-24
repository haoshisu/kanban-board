import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vite.dev/config/
export default defineConfig({
 plugins: [react(), tailwindcss(), visualizer({ open: true })],
 build: {
  rolldownOptions: {
   output: {
    manualChunks(id) {
     if (id.includes('node_modules')) {
      //React 相關
      if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
       return 'react-vendor';
      }
      if (id.includes('dnd-kit')) return 'dnd-kit';
      if (
       id.includes('@supabase') ||
       id.includes('realtime-js') ||
       id.includes('postgrest-js') ||
       id.includes('gotrue-js') ||
       id.includes('storage-js')
      ) {
       return 'supabase';
      }
     }
    },
   },
  },
 },
});
