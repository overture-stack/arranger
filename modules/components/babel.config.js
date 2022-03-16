module.exports = {
  presets: [
    '@babel/preset-env',
    '@babel/flow',
    [
      '@babel/preset-react',
      {
        development: process.env.BABEL_ENV === 'development',
        runtime: 'automatic',
        importSource: '@emotion/react',
      },
    ],
    '@babel/preset-typescript',
  ],
  plugins: [
    [
      'module-resolver',
      {
        alias: {
          '^@/public': './public',
          '^@/(.+)': './src/\\1',
        },
        cwd: 'packagejson',
        extensions: ['.js', '.jsx', '.d.ts', '.ts', '.tsx'],
        root: ['./src'],
      },
    ],
    '@emotion/babel-plugin',
    '@babel/plugin-proposal-export-namespace-from',
    '@babel/plugin-proposal-optional-chaining',
    '@babel/plugin-proposal-object-rest-spread',
    '@babel/plugin-proposal-class-properties',
    '@babel/plugin-transform-runtime',
  ],
};
