/** @type {import('next').NextConfig} */

// «/» var en permanent omdirigering til /overview. Fra 2026-09-16 er «/» den
// nye, lyse flaten for Kim og Anniken ((ny)/page.tsx), og det gamle dashbordet
// ligger uendret paa /overview og i sidebaren derfra.
//
// Merk: omdirigeringen var `permanent: true`, saa nettlesere som har besøkt
// os.detox.no foer kan ha den cachet. Den forsvinner av seg selv, men den
// første aapningen i en gammel nettleser kan fortsatt lande paa /overview.
const nextConfig = {}

export default nextConfig
