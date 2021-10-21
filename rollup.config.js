import typescript from '@rollup/plugin-typescript';
import nodeResolve from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';

export default {
  external: ['three'],
  input: 'src/index.ts',
  plugins: [
    nodeResolve(),
    typescript()
  ],
  output: [
    {
      file: 'build/threeoctree.module.js',
      format: 'es'
    },
    {
      file: 'build/threeoctree.js',
      format: 'umd',
      name: 'THREE',
      extend: true,
      globals: {
        three: 'THREE'
      }
    },
    {
      file: 'build/threeoctree.min.js',
      format: 'umd',
      name: 'THREE',
      plugins: [
        terser()
      ],
      extend: true,
      globals: {
        three: 'THREE'
      }
    },
    {
      file: 'docs/lib/threeoctree.min.js',
      format: 'umd',
      name: 'THREE',
      plugins: [
        terser()
      ],
      extend: true,
      globals: {
        three: 'THREE'
      }
    }
  ]
};
