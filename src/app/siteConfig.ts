export const siteConfig = {
  name: "detox.OS",
  url: "https://os.detox.no",
  description: "Operator-OS for detox.no",
  baseLinks: {
    home: "/",
    // Daglig
    idag: "/i-dag",
    status: "/status",
    overview: "/overview",
    // Vekst
    annonser: "/annonser",
    annonserKanaler: "/annonser/kanaler",
    annonserKampanjer: "/annonser/kampanjer",
    annonserSoketermer: "/annonser/soketermer",
    annonserAnbefalinger: "/annonser/anbefalinger",
    annonserForslag: "/annonser/forslag",
    annonserTrafikksegment: "/annonser/trafikksegment",
    butikk: "/butikk",
    kundeservice: "/kundeservice",
    anmeldelser: "/anmeldelser",
    innhold: "/innhold",
    quiz: "/quiz",
    // Operasjon
    klinisk: "/klinisk",
    leverandorer: "/leverandorer",
    agenter: "/agenter",
    pipelines: "/pipelines",
    sops: "/sops",
    // Kunnskap
    notater: "/notater",
    roadmap: "/roadmap",
    claude: "/claude",
    // Virksomhet
    okonomi: "/okonomi",
    innstillinger: "/innstillinger",
  },
}

export type siteConfig = typeof siteConfig
