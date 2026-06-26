import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({ // build v2
  plugins: [react()],
})
