import Link from "next/link"
import { notFound } from "next/navigation"

import { JA_BETYR, KORT_UUID_RE, kildeLenke, kortSeksjoner, statusTekst } from "@/lib/kort"
import { fetchKortEtt, fetchVentendePost } from "@/lib/kort-server"

import { Hjelp, Knapper, Seksjon, Stille, Svar } from "../../Seksjon"
import { varighet } from "../../dagens"
import { PostKnapper } from "../../koe/PostKnapper"
import { Bestill } from "../Bestill"

// Ett kort, hele kortet, i eierens rekkefølge. Nederst: det du kan gjøre med
// det. Et ja skrives som avgjørelse i koe_poster (huben tar kortet i bruk);
// en bestilling skrives i requests (Anakin lager utkast). Ingenting publiseres.

export const dynamic = "force-dynamic"

export default async function KortEttSide({ params }: { params: { id: string } }) {
  if (!KORT_UUID_RE.test(params.id)) notFound()
  const naa = new Date()
  const [res, ventende] = await Promise.all([fetchKortEtt(params.id), fetchVentendePost(params.id)])

  if (res.ok && !res.rad) notFound()

  return (
    <>
      <div className="ny-hilsen">
        <div className="ny-dato">
          <Link href="/kort">← Kortene</Link>
        </div>
        {res.ok && res.rad ? (
          <>
            <h1 className="ny-lede">{res.rad.title}</h1>
            <p className="ny-hjelp">
              {res.rad.story} · versjon {res.rad.version} · {statusTekst(res.rad.status)} · oppdatert for{" "}
              {varighet(res.rad.updated_at, naa)} siden
            </p>
          </>
        ) : (
          <h1 className="ny-lede">Kortet</h1>
        )}
      </div>

      {!res.ok ? (
        <Seksjon merkelapp="Kortet">
          <Stille>
            <span className="varsel">Fikk ikke lest kortet.</span> {res.error}
          </Stille>
        </Seksjon>
      ) : null}

      {res.ok && res.rad
        ? kortSeksjoner(res.rad.body).map((s) => (
            <Seksjon key={s.key} merkelapp={s.merkelapp}>
              <p className="ny-kort-overskrift">{s.overskrift}</p>
              {s.tekst ? <p className="ny-kort-tekst">{s.tekst}</p> : null}
              {s.kanaler ? (
                <dl className="ny-kanaler">
                  {s.kanaler.map((k) => (
                    <div key={k.navn}>
                      <dt>{k.navn}</dt>
                      <dd>{k.tekst}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {s.punkter ? (
                <ul className={s.key === "aldri_si" ? "ny-punkter aldri" : "ny-punkter"}>
                  {s.punkter.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              ) : null}
            </Seksjon>
          ))
        : null}

      {res.ok && res.rad ? (
        <Seksjon merkelapp="Ta stilling">
          {ventende.ok && ventende.post ? (
            <>
              <Svar>Dette kortet venter på ja fra deg</Svar>
              <Hjelp>{JA_BETYR}</Hjelp>
              <PostKnapper post={ventende.post} />
            </>
          ) : res.rad.status === "active" ? (
            <>
              <Svar>Kortet er i bruk</Svar>
              <Hjelp>DetoxGPT og agentene svarer fra det. Vil du trekke det, si fra til Indigo.</Hjelp>
            </>
          ) : res.rad.status === "draft" ? (
            <>
              <Svar>Kortet er et utkast</Svar>
              <Hjelp>
                Det står ikke i køen din ennå. Neste synk fra huben legger det der, og da kan du si ja her.
              </Hjelp>
            </>
          ) : (
            <Stille>{statusTekst(res.rad.status)}.</Stille>
          )}
          {!ventende.ok ? (
            <Stille>
              <span className="varsel">Fikk ikke lest køen.</span> {ventende.error}
            </Stille>
          ) : null}
        </Seksjon>
      ) : null}

      {res.ok && res.rad ? (
        <Seksjon merkelapp="Gjør noe">
          <Svar>Lag innhold av vinkelen</Svar>
          <Hjelp>
            Anakin lager et utkast fra «Dette kan vi si» og vinkelen. Du får det i tråden på /eiere. Kun
            utkast, ingenting publiseres.
          </Hjelp>
          <Knapper>
            <Bestill slag="kort" id={res.rad.id} />
            {kildeLenke(res.rad.source_repo, res.rad.source_path) ? (
              <a
                className="ny-knapp"
                href={kildeLenke(res.rad.source_repo, res.rad.source_path) ?? "#"}
                target="_blank"
                rel="noreferrer"
              >
                Åpne kilden i ICM
              </a>
            ) : null}
          </Knapper>
        </Seksjon>
      ) : null}
    </>
  )
}
