import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: '/BibliotecaDeImovel/',
    plugins: [react()],
    define: {
      'process.env': env
    }
  }
})
