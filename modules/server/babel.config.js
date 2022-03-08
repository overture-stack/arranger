module.exports = {
  presets: ['@babel/env', '@babel/preset-typescript'],
  plugins: [
    [
      'module-resolver',
      {
        alias: {
          '^@/configs': './configs',
          '^@/(.+)': ([, name]) => `./src/${name}`,
        },
        cwd: 'packagejson',
        extensions: ['.js', '.ts'],
      },
    ],
    '@babel/plugin-proposal-export-namespace-from',
    '@babel/plugin-proposal-optional-chaining',
    '@babel/plugin-proposal-object-rest-spread',
    '@babel/plugin-transform-runtime',
  ],
};
