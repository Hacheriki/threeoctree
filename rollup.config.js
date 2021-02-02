import typescript from '@rollup/plugin-typescript';
import nodeResolve from '@rollup/plugin-node-resolve';

export default {
  external: ['three'],
  input: 'src/index.ts',
  plugins: [
    nodeResolve(),
    typescript()
  ],
  output: [
    {
      file: 'dist/build.js',
      format: 'umd',
      name: 'THREE'
    },
    {
      file: 'dist/build.module.js',
      format: 'es'
    }
  ]
};
