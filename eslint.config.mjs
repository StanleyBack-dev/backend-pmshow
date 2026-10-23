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
  // Camadas: o domínio é puro (sem framework/persistência) e a aplicação
  // depende apenas de portas — nunca de adapters concretos.
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
                "Domain deve ser puro e nao pode depender de framework, persistencia, aplicacao ou apresentacao.",
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
                "Application deve depender de portas/contratos e nao de implementacoes concretas.",
            },
          ],
        },
      ],
    },
  },
];
