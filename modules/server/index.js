#!/usr/bin/env node
require('babel-polyfill');
require('dotenv').config();
require('@babel/register')({
  presets: ['@babel/env'],
  plugins: [
    '@babel/plugin-proposal-optional-chaining',
    '@babel/plugin-proposal-object-rest-spread',
  ],
});

require('./src').App();
