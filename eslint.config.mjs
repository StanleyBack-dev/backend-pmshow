import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["dist/**", "node_modules/**", "api/**", "*.js", "*.mjs"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { disallowTypeAnnotations: false },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Layers: the domain is pure (no framework/persistence) and the
  // application depends only on ports — never on concrete adapters.
  {
    files: ["src/modules/**/domain/**/*.ts", "src/shared/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@nestjs/*",
                "typeorm",
                "@/modules/*/infrastructure/**",
                "@/modules/*/presentation/**",
                "@/modules/*/application/**",
              ],
              message:
                "Domain must be pure: no framework, persistence, application or presentation imports.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/**/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "typeorm",
                "@/modules/*/infrastructure/**",
                "@/modules/*/presentation/**",
              ],
              message:
                "Application must depend on ports/contracts, not on concrete implementations.",
            },
          ],
        },
      ],
    },
  },
];
