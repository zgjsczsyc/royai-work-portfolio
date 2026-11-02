import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({ base: './', plugins: [vue()], server: { port: 4170, proxy: { '/api': 'http://127.0.0.1:8771' } } });
