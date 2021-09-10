#!/usr/bin/env node
require('babel-polyfill');
require('dotenv').config();
require('@babel/register')({
  presets: ['@babel/env', '@babel/preset-flow'],
  plugins: [
    '@babel/plugin-proposal-export-namespace-from',
    '@babel/plugin-proposal-optional-chaining',
    '@babel/plugin-proposal-object-rest-spread',
  ],
});

require('./src').App();
