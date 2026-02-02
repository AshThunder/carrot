import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
    plugins: [
        react(),
        wasm(),
        topLevelAwait(),
        nodePolyfills()
    ],
    server: {
        fs: {
            allow: ['..']
        }
    },
    optimizeDeps: {
        include: ['tweetnacl'],
        exclude: ['cofhejs', 'tfhe']
    }
});
