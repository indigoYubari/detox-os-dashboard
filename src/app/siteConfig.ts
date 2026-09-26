export const siteConfig = {
  name: "detox.OS",
  url: "https://os.detox.no",
  description: "Operator-OS for detox.no",
  getTitle: (pageTitle?: string) =>
    pageTitle ? `${pageTitle} – detox.OS` : "detox.OS",
  /** Sidene i den ene flaten (src/app/(ny)). Det gamle dashbordet er pensjonert 2026-09-25. */
  baseLinks: {
    home: "/",
    dagens: "/",
    koe: "/koe",
    kort: "/kort",
    ideer: "/ideer",
    eiere: "/eiere",
    radar: "/radar",
    butikk: "/butikk",
    annonser: "/annonser",
  },
}

export type siteConfig = typeof siteConfig
