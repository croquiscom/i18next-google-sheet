const path = require('path');

module.exports = {
  extends: ['@croquiscom/eslint-config-www', 'prettier'],
  ignorePatterns: ['.eslintrc.js'],
  parserOptions: {
    project: path.resolve(__dirname, 'tsconfig.json'),
  },
  settings: {
    'import/resolver': {
      typescript: {
        project: path.resolve(__dirname, 'tsconfig.json'),
      },
    },
  },
};
