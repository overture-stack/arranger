module.exports = {
  presets: [
    '@babel/env',
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
          '^@/(.*)': ([, name]) => `./src/${name}`,
        },
        cwd: 'packagejson',
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
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
