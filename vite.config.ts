import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The page code still imports the Feishu Spark runtime by its original name.
// Every such import resolves to one local shim (see client/src/platform/index.tsx).
const shim = path.resolve(__dirname, 'client/src/platform/index.tsx')

export default defineConfig({
  root: path.resolve(__dirname, 'client'),
  publicDir: path.resolve(__dirname, 'client/public'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: '@shared', replacement: path.resolve(__dirname, 'shared') },
      { find: '@client', replacement: path.resolve(__dirname, 'client') },
      { find: '@', replacement: path.resolve(__dirname, 'client/src') },
      { find: /^@lark-apaas\/client-toolkit(\/.*)?$/, replacement: shim },
    ],
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  server: { port: 4180 },
})
