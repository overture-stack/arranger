module.exports = {
  presets: [
    '@babel/env',
    '@babel/flow',
    ['@babel/preset-react', { development: process.env.BABEL_ENV === 'development' }],
    '@babel/preset-typescript',
  ],
  plugins: [
    '@babel/plugin-proposal-optional-chaining',
    '@babel/plugin-proposal-object-rest-spread',
    '@babel/plugin-proposal-class-properties',
    '@babel/plugin-transform-runtime',
    'emotion',
  ],
};
