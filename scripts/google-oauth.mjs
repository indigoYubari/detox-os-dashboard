import { createServer } from "http";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "../.env.local");
let CLIENT_ID, CLIENT_SECRET;

try {
  const env = readFileSync(envPath, "utf-8");
  for (const line of env.split("\n")) {
    if (line.startsWith("GOOGLE_CLIENT_ID=")) CLIENT_ID = line.split("=")[1].trim();
    if (line.startsWith("GOOGLE_CLIENT_SECRET=")) CLIENT_SECRET = line.split("=")[1].trim();
  }
} catch {
  console.error("Finner ikke .env.local");
  process.exit(1);
}

const REDIRECT_URI = "http://localhost:3999/callback";
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly","https://www.googleapis.com/auth/gmail.modify"].join(" ");
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(CLIENT_ID)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(SCOPES)}&access_type=offline&prompt=consent`;

console.log("\nÅpner nettleseren - logg inn med kontakt@detox.no\n");
const { exec } = await import("child_process");
exec(`open "${authUrl}"`);

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:3999");
  if (url.pathname !== "/callback") return;
  const code = url.searchParams.get("code");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: "authorization_code" }),
  });
  const tokens = await tokenRes.json();
  if (tokens.refresh_token) {
    console.log("\nLegg dette til i .env.local og Railway:");
    console.log(`GOOGLE_REFRESH_TOKEN_KONTAKT=${tokens.refresh_token}\n`);
    res.end("<h2>Ferdig! Lukk denne fanen.</h2>");
  } else {
    console.error("Feil:", JSON.stringify(tokens, null, 2));
    res.end("<h2>Feil - se terminalen</h2>");
  }
  server.close();
});

server.listen(3999, () => console.log("Venter på callback på port 3999..."));
