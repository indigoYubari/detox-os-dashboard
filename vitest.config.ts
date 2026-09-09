import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  // tsconfig har jsx: preserve (Next). Vitest maa selv kompilere TSX for aa
  // kunne rendre sider i tester (eiere-page.test.ts).
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
    environment: "node",
  },
})
