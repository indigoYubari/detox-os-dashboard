import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GPT_CREDENTIAL_HEADER } from "../auth-policy"
import { resolveGptClient, sha256Hex } from "../gpt-auth"

// Credentialen som brukes i testene er tilfeldig generert HER og har aldri
// eksistert i produksjon. Ingen ekte credential skal noensinne inn i repoet.
const TEST_CREDENTIAL = "t".repeat(43) + "X"
const TEST_HASH = sha256Hex(TEST_CREDENTIAL)

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env.KIM_GPT_CREDENTIAL_SHA256 = TEST_HASH
  process.env.KIM_GPT_SUPABASE_PASSWORD = "irrelevant-for-disse-testene"
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe("GPT-credential-verifisering", () => {
  it("avviser manglende credential", () => {
    expect(resolveGptClient(null)).toBeNull()
  })

  it("avviser tom credential", () => {
    expect(resolveGptClient("")).toBeNull()
  })

  it("avviser en credential som er for kort til å være ekte", () => {
    expect(resolveGptClient("kort")).toBeNull()
  })

  it("avviser en credential med feil verdi", () => {
    expect(resolveGptClient("f".repeat(44))).toBeNull()
  })

  it("avviser hashen selv som credential", () => {
    // Lekker hashen fra env, er den fortsatt ikke en gyldig credential.
    expect(resolveGptClient(TEST_HASH)).toBeNull()
  })

  it("godtar riktig credential og gir maskinprinsipalen", () => {
    const client = resolveGptClient(TEST_CREDENTIAL)
    expect(client).not.toBeNull()
    expect(client!.principal).toBe("kim-gpt")
    expect(client!.configuredFor).toBe("kim")
  })

  it("prinsipalen er aldri et menneskenavn", () => {
    const client = resolveGptClient(TEST_CREDENTIAL)
    expect(client!.principal).not.toBe("kim")
    expect(client!.principal).toBe("kim-gpt")
  })

  it("tolererer whitespace rundt credentialen", () => {
    expect(resolveGptClient(`  ${TEST_CREDENTIAL}  `)?.principal).toBe(
      "kim-gpt",
    )
  })

  it("gir ingen klient når env-hashen mangler", () => {
    delete process.env.KIM_GPT_CREDENTIAL_SHA256
    expect(resolveGptClient(TEST_CREDENTIAL)).toBeNull()
  })

  it("gir ingen klient når passordet mangler (revokering)", () => {
    // Å tømme én av de to env-variablene revokerer klienten uten kodeendring.
    delete process.env.KIM_GPT_SUPABASE_PASSWORD
    expect(resolveGptClient(TEST_CREDENTIAL)).toBeNull()
  })

  it("holder Kim og Anniken adskilt", () => {
    const annikenCredential = "a".repeat(43) + "Y"
    process.env.ANNIKEN_GPT_CREDENTIAL_SHA256 = sha256Hex(annikenCredential)
    process.env.ANNIKEN_GPT_SUPABASE_PASSWORD = "irrelevant"

    expect(resolveGptClient(TEST_CREDENTIAL)!.principal).toBe("kim-gpt")
    expect(resolveGptClient(annikenCredential)!.principal).toBe("anniken-gpt")
    // Kims credential gir aldri Annikens prinsipal, og omvendt.
    expect(resolveGptClient(TEST_CREDENTIAL)!.configuredFor).toBe("kim")
    expect(resolveGptClient(annikenCredential)!.configuredFor).toBe("anniken")
  })
})

describe("headeren", () => {
  it("er den avtalte, og deles av middleware og verifiserer", () => {
    expect(GPT_CREDENTIAL_HEADER).toBe("x-detox-gpt-key")
  })
})
