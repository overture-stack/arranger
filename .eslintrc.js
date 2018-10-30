module.exports = {
  extends: [
    'prettier',
    'prettier/flowtype',
    'plugin:flowtype/recommended',
    'react-app',
    'plugin:jsx-a11y/strict',
  ],
  plugins: ['flowtype', 'prettier', 'jsx-a11y'],
  rules: {
    'prettier/prettier': [1, { trailingComma: 'all', singleQuote: true }],
    'flowtype/define-flow-type': 1,
    'jsx-a11y/href-no-hash': 'off',
  },
};
