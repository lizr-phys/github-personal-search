import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "off",
      "import/no-anonymous-default-export": "off"
    }
  },
  globalIgnores([".next/**", "coverage/**", "playwright-report/**", "test-results/**", "work/**", "next-env.d.ts"])
]);
