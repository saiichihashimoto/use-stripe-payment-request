/* eslint sort-keys-fix/sort-keys-fix: ["error", "asc", { natural: true }] -- This rule is ONLY for this .eslintrc.js file, not as a rule in our codebase. */
/* eslint-disable sort-keys-fix/sort-keys-fix -- Usually, our eslint comment pairs are enabling then disabling rules. Since we can only properly configure this by globally enabling it, we immediately disable it here (and reenable at the bottom), so we can have disable then enable pairs around objects. */

// Some @typescript-eslint/eslint-plugin rules require type-checking to work, ie running typescript. This can get heavy, especially in IDEs where we save and linting is running in realtime. https://github.com/typescript-eslint/typescript-eslint/tree/main/packages/eslint-plugin#recommended-configs
// Instead, we run all "heavy" eslint rules only on lint-staged and on push. This ensures we run all of our rules before commits, but our IDEs won't lag.
// The con is that there are linting errors we can't know until commit. Ideally, most of these are autofixes to no block us.

const testFiles = ["**/*.spec.*", "jest.setup.ts"];

/**
 * @type {import('eslint').Linter.Config}
 */
const config = {
  env: { es6: true },
  extends: ["./.eslintrc.js"],
  overrides: [
    {
      files: ["**/*.ts", "**/*.tsx"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        project: ["./tsconfig.json"],
      },
      plugins: ["@typescript-eslint", "typescript-sort-keys"],
      extends: [
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
      ],
      /* eslint-enable sort-keys-fix/sort-keys-fix -- Sorting rules */
      rules: {
        "@typescript-eslint/no-confusing-void-expression": [
          "error",
          { ignoreArrowShorthand: true, ignoreVoidOperator: true },
        ],
        "@typescript-eslint/no-floating-promises": "error",
        "@typescript-eslint/no-meaningless-void-operator": [
          "error",
          { checkNever: false },
        ],
        "@typescript-eslint/no-unnecessary-boolean-literal-compare": [
          "error",
          {
            allowComparingNullableBooleansToFalse: false,
            allowComparingNullableBooleansToTrue: false,
          },
        ],
        "@typescript-eslint/no-unnecessary-condition": [
          "error",
          { allowConstantLoopConditions: true },
        ],
        "@typescript-eslint/no-unnecessary-type-assertion": "error",
        "@typescript-eslint/non-nullable-type-assertion-style": "error",
        "@typescript-eslint/prefer-nullish-coalescing": [
          "error",
          {
            ignoreConditionalTests: false,
            ignoreMixedLogicalExpressions: false,
          },
        ],
        "@typescript-eslint/prefer-reduce-type-parameter": "error",
        "@typescript-eslint/promise-function-async": "error",
      },
      /* eslint-disable sort-keys-fix/sort-keys-fix -- Sorting rules */
    },
    {
      files: testFiles,
      env: { "jest/globals": true, jest: true },
      plugins: ["jest"],
      /* eslint-enable sort-keys-fix/sort-keys-fix -- Sorting rules */
      rules: {
        "@typescript-eslint/unbound-method": "off",
      },
      /* eslint-disable sort-keys-fix/sort-keys-fix -- Sorting rules */
    },
  ],
};
/* eslint-enable sort-keys-fix/sort-keys-fix */

module.exports = config;
