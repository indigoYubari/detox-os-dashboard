"use client"

import { supabase } from "@/lib/supabase"

import React from "react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/oppdater-passord`, // Supabase redirect, requires /oppdater-passord route
    })

    if (error) {
      setError("Kunne ikke sende tilbakestillingslenke. Sjekk e-postadressen din og prøv igjen.")
    } else {
      setMessage("Hvis e-postadressen din er registrert hos oss, har du mottatt en lenke for å tilbakestille passordet ditt.")
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="inline-flex size-10 items-center justify-center rounded bg-indigo-600 text-sm font-semibold text-white">
            OS
          </span>
          <h1 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-50">
            Glemt passord
          </h1>
          <p className="mt-1 text-sm text-gray-500">detox.OS</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                E-post *
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-500 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-50"
              />
            </div>

            {message && (
              <p className="text-sm text-green-600 dark:text-green-400">{message}</p>
            )}

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? "Sender lenke…" : "Send tilbakestillingslenke"}
            </button>

            <div className="mt-4 text-center">
              <a href="/login" className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                Tilbake til innlogging
              </a>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
