module.exports = {
  env: {
    browser: true,
  },
  extends: [
    'plugin:jsx-a11y/strict',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@emotion', 'react', 'jsx-a11y'],
  rules: {
    '@emotion/import-from-emotion': 'error',
    '@emotion/no-vanilla': 'error',
    '@emotion/pkg-renaming': 'error',
    '@emotion/styled-import': 'error',
    'jsx-a11y/href-no-hash': 'off',
    'react/prop-types': ['warn', { skipUndeclared: true }],
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
