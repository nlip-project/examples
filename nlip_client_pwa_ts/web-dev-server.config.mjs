/**
 * Copyright (c) IBM, Corp. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { fileURLToPath } from 'url';

import { esbuildPlugin } from '@web/dev-server-esbuild';

export default {
  appIndex: 'index.html',
  nodeResolve: true,
  preserveSymlinks: true,
  plugins: [
    esbuildPlugin({
      ts: true,
      tsconfig: fileURLToPath(new URL('./tsconfig.json', import.meta.url)),
    }),
  ],
  middleware: [
    function rewriteIndex(context, next) {
      if (context.url === '/') {
        context.url = '/index.html';
      }
      return next();
    },
  ],
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
};
