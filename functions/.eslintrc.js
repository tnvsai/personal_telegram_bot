module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    "quotes": ["error", "double"],
    "linebreak-style": 0,
    "object-curly-spacing": 0,
    "indent": ["error", 2],
    "max-len": 0,
  },
  parserOptions: {
    ecmaVersion: 2020,
  },
};
