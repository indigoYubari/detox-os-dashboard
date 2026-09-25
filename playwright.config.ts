import { defineConfig } from "@playwright/test"

// Røyktesten (e2e/roeyktest.spec.ts) kjører mot en ferdig bygget server:
//   BASE_URL           hvor appen svarer (default http://127.0.0.1:3000)
//   DETOX_SMOKE_EMAIL  testbrukerens e-post   (uten: bare den røde stien kjøres)
//   DETOX_SMOKE_PASSWORD
//   PW_CHROMIUM        sti til en Chromium-binær når Playwright ikke skal laste ned sin egen
// Verdiene leses fra miljøet og skrives aldri til rapport, skjermbilde eller logg.

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  outputDir: "e2e/.resultater",
  use: {
    baseURL: process.env.BASE_URL ?? "http://127.0.0.1:3000",
    headless: true,
    screenshot: "off",
    trace: "off",
    ...(process.env.PW_CHROMIUM
      ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } }
      : {}),
  },
})
