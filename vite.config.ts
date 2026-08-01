import { defineConfig, lazyPlugins } from 'vite-plus'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: lazyPlugins(() => [react(), tailwindcss()]),
  fmt: {
    semi: false,
    singleQuote: true,
  },
  lint: {
    plugins: ['react', 'typescript', 'oxc'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      'react/rules-of-hooks': 'error',
      'react/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    passWithNoTests: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  build: {
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks(id) {
          const moduleId = id.replaceAll('\\', '/')

          if (/\/node_modules\/(?:react|react-dom|scheduler)\//.test(moduleId)) {
            return 'react-vendor'
          }

          if (moduleId.includes('/node_modules/@base-ui/')) {
            return 'base-ui'
          }

          if (moduleId.includes('/node_modules/sonner/')) {
            return 'sonner'
          }
        },
      },
    },
  },
})
