import { defineConfig } from 'vite'

export default defineConfig({
  base: "/minesweeper/",
  build: {
    outDir: 'dist',
    target: 'ES2020'
  },
  server: {
    port: 5173,
    strict: false
  }
})
