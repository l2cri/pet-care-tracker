/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base — под-path проектного сайта GitHub Pages (ADR-0007)
export default defineConfig({
  base: '/pet-care-tracker/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
