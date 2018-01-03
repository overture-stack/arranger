require('dotenv').config()
require('babel-polyfill')
require('@babel/register')({
  presets: ['@babel/env'],
  plugins: [
    '@babel/plugin-proposal-optional-chaining',
    '@babel/plugin-proposal-object-rest-spread',
  ],
})

// global.config = require(`./${process.env.CONFIG}.config`)

require('./src/index')
