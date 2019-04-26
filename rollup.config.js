// import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';

export default {
  input: 'src/index.js',
  output: [
    {file: 'dist/we-cjs.js', format: 'cjs'},
    {file: 'dist/we.mjs', format: 'es'}
  ],
  plugins: [
    babel({
      exclude: 'node_modules/**'
    })
  ]
}