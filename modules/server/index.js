#!/usr/bin/env node
require('babel-polyfill');
require('dotenv').config();
require('@babel/register')({
  extensions: ['.js', '.ts'],
  presets: ['@babel/env', '@babel/preset-typescript'],
  plugins: [
    '@babel/plugin-proposal-export-namespace-from',
    '@babel/plugin-proposal-optional-chaining',
    '@babel/plugin-proposal-object-rest-spread',
    '@babel/plugin-transform-runtime',
  ],
});

require('./src').App(__dirname);
