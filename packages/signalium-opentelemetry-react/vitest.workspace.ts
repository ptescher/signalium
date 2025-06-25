/// <reference types="@vitest/browser/providers/playwright" />

import { defineWorkspace } from 'vitest/config';
import react from '@vitejs/plugin-react';
import babel from 'vite-plugin-babel';
import { signaliumAsyncTransform } from '../signalium/src/transform.js';

export default defineWorkspace([
  {
    plugins: [
      react(),
      (babel as any)({
        filter: /\.(j|t)sx?$/,
        babelConfig: {
          babelrc: false,
          configFile: false,
          sourceMaps: true,
          plugins: [
            signaliumAsyncTransform({
              transformedImports: [
                ['reactive', /instrumented-hooks.js$/],
                ['task', /instrumented-hooks.js$/],
              ],
            }),
          ],
          parserOpts: {
            plugins: ['typescript', 'jsx'],
          },
        },
      }),
    ],
    test: {
      include: [], // Remove src/index.test.tsx from unit tests
      name: 'unit',
      environment: 'jsdom', // changed from 'node' to 'jsdom' for JSX support
    },
  },
  {
    plugins: [
      react({
        babel: {
          plugins: [
            // Only apply signaliumAsyncTransform to src/signalium, not to this package
          ],
        },
      }),
    ],
    test: {
      include: ['src/index.test.tsx'], // Only run in browser project
      browser: {
        enabled: true,
        provider: 'playwright',
        instances: [{ browser: 'chromium' }],
      },
    },
  },
]);
