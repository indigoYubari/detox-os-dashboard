import { expect, test, type Page } from "@playwright/test"

// Virkelighetsbevis for den ene flaten (byggemodellen 007, steg 6: «verifiser
// mot virkeligheten» og «den røde stien må også virke»).
//
// To stier:
//   RØD  — uten innlogging skal hver side sende til /login og API-et svare 401.
//          Kjører alltid.
//   GRØNN — med en testbruker (DETOX_SMOKE_EMAIL/PASSWORD) logges det inn, hver
//          side åpnes, og vi krever: en overskrift, ingen «Fikk ikke lest»,
//          ingen JS-feil i konsollen. Ett skjermbilde per side legges i
//          e2e/skjermbilder/. Kjører bare når hemmelighetene finnes.
//
// Testen SKRIVER ALDRI: ingen ja/nei, ingen «Be Anakin», ingen skjema sendes.
// Passord og e-post havner aldri i rapport, skjermbilde eller logg.

const SIDER = [
  { sti: "/", navn: "dagens" },
  { sti: "/koe", navn: "koe" },
  { sti: "/kort", navn: "kort" },
  { sti: "/ideer", navn: "ideer" },
  { sti: "/eiere", navn: "eiere" },
  { sti: "/radar", navn: "radar" },
  { sti: "/butikk", navn: "butikk" },
  { sti: "/annonser", navn: "annonser" },
] as const

const API = ["/api/v1/me", "/api/detox/metrics"] as const

const EMAIL = process.env.DETOX_SMOKE_EMAIL
const PASSORD = process.env.DETOX_SMOKE_PASSWORD
const HAR_BRUKER = Boolean(EMAIL && PASSORD)

test.describe("rød sti — uten innlogging", () => {
  for (const s of SIDER) {
    test(`${s.sti} sender til /login`, async ({ page }) => {
      const svar = await page.goto(s.sti)
      expect(svar, "fikk ikke noe svar").not.toBeNull()
      await expect(page).toHaveURL(/\/login$/)
      await expect(page.getByRole("button", { name: "Logg inn" })).toBeVisible()
    })
  }

  for (const a of API) {
    test(`${a} svarer 401 som JSON`, async ({ request }) => {
      const svar = await request.get(a)
      expect(svar.status()).toBe(401)
      expect(svar.headers()["content-type"] ?? "").toContain("application/json")
    })
  }

  test("/login svarer 200 og viser skjemaet", async ({ page }) => {
    const svar = await page.goto("/login")
    expect(svar?.status()).toBe(200)
    await expect(page.locator("#email")).toBeVisible()
    await expect(page.locator("#password")).toBeVisible()
  })
})

async function loggInn(page: Page) {
  await page.goto("/login")
  await page.locator("#email").fill(EMAIL!)
  await page.locator("#password").fill(PASSORD!)
  await page.getByRole("button", { name: "Logg inn" }).click()
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 })
}

test.describe("grønn sti — innlogget", () => {
  test.skip(!HAR_BRUKER, "DETOX_SMOKE_EMAIL/PASSWORD er ikke satt — bare den røde stien kjøres")

  test("hver side åpner, svarer med en overskrift, og ingen kilde er ulest", async ({ page }) => {
    const konsollFeil: string[] = []
    page.on("console", (m) => {
      if (m.type() === "error") konsollFeil.push(m.text())
    })
    page.on("pageerror", (e) => konsollFeil.push(String(e)))

    await loggInn(page)

    for (const s of SIDER) {
      const svar = await page.goto(s.sti)
      expect(svar?.status(), `${s.sti} svarte ikke 200`).toBe(200)
      await expect(page, `${s.sti} ble sendt til login`).not.toHaveURL(/\/login/)
      await expect(page.locator("h1").first(), `${s.sti} mangler overskrift`).toBeVisible()
      // Klient-øynene (Shopify, annonser, Klaviyo) trenger et øyeblikk.
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {})
      const tekst = await page.locator("main").innerText()
      expect(tekst, `${s.sti} sier at en kilde ikke ble lest:\n${tekst.slice(0, 600)}`).not.toMatch(
        /Fikk ikke lest/,
      )
      await page.screenshot({ path: `e2e/skjermbilder/${s.navn}.png`, fullPage: true })
    }

    expect(konsollFeil, `JS-feil i konsollen:\n${konsollFeil.join("\n")}`).toEqual([])
  })

  test("gamle stier finnes ikke lenger", async ({ page }) => {
    await loggInn(page)
    for (const gammel of ["/overview", "/i-dag", "/innhold"]) {
      const svar = await page.goto(gammel)
      expect(svar?.status(), `${gammel} skal være borte`).toBe(404)
    }
  })
})
