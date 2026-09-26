"""register_gcp_sa.py — engangsregistrering av Cloud-prosjektet mot Merchant Center,
med service-kontoen.

DETTE ER DET ENESTE SKRIVENDE KALLET I HELE AUDIT-DATALAGET.

Det ligger bevisst UTENFOR read-only-vakten i klienter/merchant.py. Vakten der har
en tillatelsesliste med fire leseendepunkter og ville avvist dette kallet — det er
meningen. Skriptet importerer ikke merchant-klienten i det hele tatt.

Hvorfor service-kontoen og ikke en OAuth-klient:
  `accounts.developerRegistration.registerGcp` tar INGEN prosjekt-parameter.
  Kroppen er bare {"developerEmail": ...}. Google utleder Cloud-prosjektet fra
  legitimasjonen som gjør kallet. Service-kontoen
  audit-reader@detox-audit.iam.gserviceaccount.com ligger i detox-audit
  (nr. 231263225804), som er nøyaktig det prosjektet Google ba om å få registrert:

      401 UNAUTHENTICATED, REASON=GCP_NOT_REGISTERED
      "GCP project with id detox-audit and number 231263225804 is not registered
       with the merchant account."

  Repoets eksisterende GOOGLE_CLIENT_ID hører til et annet prosjekt (Gmail,
  kontakt@detox.no). Den ville registrert feil prosjekt — og ett Cloud-prosjekt
  kan bare registreres mot én Merchant Center-konto.

Krav fra Google, og hva som er usikkert:
  - Kallet må gjøres av noen med ADMIN i Merchant Center. Service-kontoen har
    normalt bare Standard, så Kim hever den til Admin midlertidig, kjører dette
    skriptet, og setter den tilbake.
  - `developerEmail` skal være en vanlig Google-konto, ikke service-kontoen.
    Derfor b2b@detox.no, som er eneste Admin.
  - UVERIFISERT: om Google godtar en SERVICE-KONTO som kaller på denne metoden
    står ikke eksplisitt i dokumentasjonen. Svarer den 403, er det svaret — og da
    må registreringen gjøres med en OAuth-klient i detox-audit i stedet.
    Skriptet gjetter ikke; det skriver ut hva Google faktisk sa.

Kjøres ÉN gang, manuelt, av et menneske. Ikke i jobbene, ikke i en timer.

Bruk (fra workers/audit):
  .venv/bin/python skript/register_gcp_sa.py

Skriptet printer nøyaktig hva det vil sende og venter på at du skriver JA.
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

# Med vilje IKKE klienter.merchant — dette kallet skal ikke gjennom vakten.
from felles.google_auth import AuthFeil, hent_token
from felles.hemmelig import les_env, mangler, masker

SCOPE = "https://www.googleapis.com/auth/content"

# v1beta ble stengt 28.02.2026. developerRegistration ligger i accounts-sub-API-et.
API_VERSJON = "v1"
VERT = "https://merchantapi.googleapis.com"

STANDARD_KONTO = "5365874444"
DEVELOPER_EMAIL = "b2b@detox.no"


def _endepunkt(konto: str) -> str:
    return (f"{VERT}/accounts/{API_VERSJON}/accounts/{konto}"
            "/developerRegistration:registerGcp")


def _forklar(status: int, tekst: str) -> str:
    if status == 200:
        return "Registrert. Dette skal ikke kjøres igjen."
    if status == 403:
        return ("403 — kontoen som kalte har ikke ADMIN i Merchant Center, ELLER "
                "Google godtar ikke en service-konto på denne metoden. Sjekk at "
                "audit-reader står som Admin. Står den som Admin og du fortsatt får "
                "403, må registreringen gjøres med en OAuth-klient opprettet i "
                "prosjektet detox-audit. Ikke gjett — det er to ulike årsaker.")
    if status == 404:
        return ("404 — stien eller API-versjonen er feil, ikke at kontoen mangler. "
                "Sjekk gjeldende dokumentasjon for "
                "accounts.developerRegistration.registerGcp og rett API_VERSJON "
                "eller stien i dette skriptet.")
    if status == 401:
        return ("401 — tokenet ble ikke godtatt. Er REASON=GCP_NOT_REGISTERED, har "
                "kallet ikke tatt effekt ennå. Vent noen minutter og prøv igjen.")
    if status == 409:
        return ("409 — prosjektet er sannsynligvis alt registrert. Ett Cloud-prosjekt "
                "kan bare registreres mot én Merchant Center-konto.")
    return f"HTTP {status} — uventet. Les svaret over før du gjør noe mer."


def kjor(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    env = les_env()
    konto = env.get("MERCHANT_ACCOUNT_ID") or STANDARD_KONTO

    if mangler(env, "GOOGLE_SA_JSON") and mangler(env, "GOOGLE_SA_JSON_PATH"):
        print("FEIL: finner ikke service-konto-nøkkelen. Forventet "
              "~/.config/detox-audit/sa.json, eller GOOGLE_SA_JSON / "
              "GOOGLE_SA_JSON_PATH satt.")
        return 1

    try:
        token = hent_token(env, [SCOPE])
    except AuthFeil as e:
        print(f"FEIL ved autentisering: {e}")
        return 1

    url = _endepunkt(konto)
    kropp = {"developerEmail": DEVELOPER_EMAIL}

    print()
    print("─" * 70)
    print("SKRIVENDE KALL. Ingenting er sendt ennå.")
    print("  metode:          POST")
    print(f"  url:             {url}")
    print(f"  kropp:           {json.dumps(kropp)}")
    print(f"  konto:           {konto}")
    print(f"  developerEmail:  {DEVELOPER_EMAIL}")
    print("  autentisering:   service-konto (prosjekt detox-audit)")
    print(f"  scope:           {SCOPE}")
    print("─" * 70)
    print("Krav: kontoen som kaller må ha ADMIN i Merchant Center.")
    print("Dette kallet skal gjøres ÉN gang. Etterpå: sett tilgangen tilbake til")
    print("Standard, og før endringen inn i audit_change_log.")
    print()

    if "--ja" in argv:
        # Finnes kun for en ikke-interaktiv kjøring der et menneske alt har
        # bestemt seg. Standardveien er å skrive JA.
        print("--ja oppgitt, hopper over porten.")
    else:
        try:
            svar = input("Skriv JA for å sende, hva som helst annet for å avbryte: ")
        except (EOFError, KeyboardInterrupt):
            print("\nAvbrutt. Ingenting er sendt.")
            return 1
        if svar.strip() != "JA":
            print("Avbrutt. Ingenting er sendt.")
            return 1

    req = urllib.request.Request(
        url,
        data=json.dumps(kropp).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "detox-audit/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            status, raa = r.status, r.read().decode(errors="replace")
    except urllib.error.HTTPError as e:
        status, raa = e.code, e.read().decode(errors="replace")
    except Exception as e:  # noqa: BLE001 — tokenet skal aldri ut i en feilmelding
        print(f"\nFEIL: {type(e).__name__}: {masker(str(e), token)[:300]}")
        return 1

    print(f"\nHTTP {status}")
    print(masker(raa, token)[:2000] or "(tomt svar)")
    print()
    print(_forklar(status, raa))

    if status == 200:
        print()
        print("Neste steg:")
        print("  1. Vent 5 minutter — Google sier det selv.")
        print("  2. Sett audit-reader tilbake til Standard i Merchant Center.")
        print("  3. .venv/bin/python -m jobber.merchant_kontroll --tilganger")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(kjor())
