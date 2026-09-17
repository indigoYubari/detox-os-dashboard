"use client"

import { useState, useTransition } from "react"

import { JA_TEKST, NEI_TEKST, type Beslutning, type KoePost } from "@/lib/koe-poster"

import { avgjorPostAction, type AvgjorResult } from "./actions"

/**
 * Knappene paa én post. Skriver bare avgjoerelsen; huben utfoerer. Etter et
 * svar staar kvitteringen til siden er lastet paa nytt — posten forsvinner
 * fra koeen av seg selv (revalidatePath), men vi later ikke som den er utfoert.
 */
export function PostKnapper({ post }: { post: KoePost }) {
  const [pending, start] = useTransition()
  const [res, setRes] = useState<AvgjorResult | null>(null)

  function avgjor(beslutning: Beslutning) {
    start(async () => {
      setRes(await avgjorPostAction({ id: post.id, beslutning }))
    })
  }

  if (res?.ok) {
    return (
      <div className="ny-knapper">
        <span className="ny-kvittering">
          Avgjort: {res.post.status}. Huben utfører det ved neste kjøring.
        </span>
      </div>
    )
  }

  return (
    <div className="ny-knapper">
      {post.handling === "gjort" ? (
        <button
          type="button"
          className="ny-knapp primaer"
          disabled={pending}
          onClick={() => avgjor("gjort")}
        >
          Gjort
        </button>
      ) : (
        <>
          <button
            type="button"
            className="ny-knapp primaer"
            disabled={pending}
            onClick={() => avgjor("ja")}
          >
            {JA_TEKST[post.koe_id] ?? "Ja"}
          </button>
          <button
            type="button"
            className="ny-knapp"
            disabled={pending}
            onClick={() => avgjor("nei")}
          >
            {NEI_TEKST[post.koe_id] ?? "Nei"}
          </button>
        </>
      )}
      {post.lenke ? (
        <a className="ny-knapp" href={post.lenke} target="_blank" rel="noreferrer">
          Åpne
        </a>
      ) : null}
      {res && !res.ok ? <span className="ny-feil">{res.error}</span> : null}
    </div>
  )
}
