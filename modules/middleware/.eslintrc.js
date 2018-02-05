module.exports = {
  extends: ['prettier', 'prettier/flowtype', 'plugin:flowtype/recommended'],
  plugins: ['flowtype', 'prettier'],
  rules: {
    'prettier/prettier': [1, { trailingComma: 'all', singleQuote: true }],
    'flowtype/define-flow-type': 1,
  },
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'module',
    ecmaFeatures: {
      modules: true,
    },
  },
};
