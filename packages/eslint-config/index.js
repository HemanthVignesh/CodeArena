module.exports = {
  env: {
    node: true,
    es2022: true,
    browser: true,
  },
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "no-unused-vars": "off",
    "no-undef": "off",
  },
  ignorePatterns: ["dist/**", "node_modules/**", ".turbo/**", ".next/**"],
};
