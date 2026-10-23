module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\.spec\.ts$",
  transform: {
    "^.+\.(t|j)s$": "ts-jest",
  },
  collectCoverageFrom: [
    "**/*.ts",
    "!**/*.spec.ts",
    "!**/*.dto.ts",
    "!**/*.orm-entity.ts",
    "!main.ts",
    "!app.module.ts",
    "!database/migrations/**",
  ],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@modules/(.*)$": "<rootDir>/modules/$1",
    "^@common/(.*)$": "<rootDir>/common/$1",
    "^@shared/(.*)$": "<rootDir>/shared/$1",
  },
};
