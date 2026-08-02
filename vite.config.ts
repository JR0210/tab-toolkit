import { defineConfig, lazyPlugins } from 'vite-plus'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defaultExclude } from 'vitest/config'

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
    // scripts/verify-build.test.mjs uses node:test's own describe/it (it has
    // its own Node-native suite, run via `node --test`, separate from this
    // Vitest suite) -- without this exclude, Vitest's default include glob
    // would also pick it up and run it under Vitest globals, which conflicts
    // with node:test's globals.
    exclude: [...defaultExclude, 'scripts/**'],
  },
  build: {
    modulePreload: { polyfill: false },
    sourcemap: false,
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
