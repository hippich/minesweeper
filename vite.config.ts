import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist',
    target: 'ES2020'
  },
  server: {
    port: 5173,
    strict: false
  }
})
