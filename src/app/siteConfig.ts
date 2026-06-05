export const siteConfig = {
  name: "detox.OS",
  url: "https://os.detox.no",
  description: "Operator-OS for detox.no",
  baseLinks: {
    home: "/",
    overview: "/overview",
    annonser: "/annonser",
    annonserKanaler: "/annonser/kanaler",
    annonserKampanjer: "/annonser/kampanjer",
    annonserSoketermer: "/annonser/soketermer",
    annonserAnbefalinger: "/annonser/anbefalinger",
    annonserTrafikksegment: "/annonser/trafikksegment",
    butikk: "/butikk",
    quiz: "/quiz",
    aiVerktoy: "/ai-verktoy",
    claude: "/claude",
    okonomi: "/okonomi",
    innstillinger: "/innstillinger",
  },
}

export type siteConfig = typeof siteConfig
