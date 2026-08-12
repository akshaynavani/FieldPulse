/** Shared ESLint config for every workspace. */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
  env: { node: true, es2022: true },
  overrides: [
    { files: ["apps/web/**/*.{ts,tsx}"], env: { browser: true } },
    { files: ["**/test/**/*.ts"], rules: { "@typescript-eslint/no-non-null-assertion": "off" } },
  ],
  ignorePatterns: ["dist", "node_modules", "coverage", ".expo", "*.config.js"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/consistent-type-imports": "error",
    "no-console": ["warn", { allow: ["warn", "error", "info"] }]
  }
};
