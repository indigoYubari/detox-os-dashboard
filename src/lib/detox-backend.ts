// Server-side klient mot ad-automation-agent på Railway.
// Basic Auth-credentials leses fra env og når ALDRI browseren.

export const DETOX_BACKEND_URL =
  process.env.DETOX_BACKEND_URL ?? "https://web-production-179ae.up.railway.app"

export function backendAuthHeaders(): Record<string, string> {
  const user = process.env.DETOX_DASHBOARD_USER
  const pass = process.env.DETOX_DASHBOARD_PASS
  const headers: Record<string, string> = {}
  if (user && pass) {
    headers["Authorization"] =
      `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`
  }
  return headers
}
