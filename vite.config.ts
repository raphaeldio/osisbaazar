import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // fileURLToPath, bukan .pathname — di Windows .pathname memberi "/D:/…"
      // dengan spasi ter-encode sehingga path-nya tidak bisa dibuka.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
