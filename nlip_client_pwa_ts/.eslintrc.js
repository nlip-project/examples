module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import'],
  env: {
    browser: true,
    node: true,
    es6: true,
  },
  rules: {
    // Ignore import/no-unresolved for .js imports in TypeScript files
    'import/no-unresolved': ['error', { ignore: ['\\.js$'] }],
    // Allow any type in specific cases
    '@typescript-eslint/no-explicit-any': 'warn',
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
};
