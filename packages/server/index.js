require('@babel/register')({
  presets: ['@babel/env'],
  plugins: ['@babel/plugin-proposal-optional-chaining'],
})

require('~')

