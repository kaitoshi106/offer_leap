import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  // ESM for the Next.js app, CJS for the NestJS app.
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  target: 'es2023',
});
