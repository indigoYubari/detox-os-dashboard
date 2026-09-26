"use client"

import { PASSORD_MIN_LENGDE, validerNyttPassord } from "@/lib/passord"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import React from "react"

// Krever sesjon (middleware). Sesjonen kommer fra /auth/callback, som veksler
// inn koden i e-postlenken. Uten sesjon sender middleware til /login.
export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    const ugyldig = validerNyttPassord(password, confirmPassword)
    if (ugyldig) {
      setError(ugyldig)
      return
    }

    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError("Kunne ikke oppdatere passordet. Be om en ny lenke og prøv igjen.")
      setLoading(false)
      return
    }

    setMessage("Passordet er oppdatert. Du sendes til forsiden …")
    setTimeout(() => {
      router.push("/")
      router.refresh()
    }, 1500)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="inline-flex size-10 items-center justify-center rounded bg-indigo-600 text-sm font-semibold text-white">
            OS
          </span>
          <h1 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-50">
            Nytt passord
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
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Nytt passord *
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                aria-describedby="password-hint"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-500 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-50"
              />
              <p id="password-hint" className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                Minst {PASSORD_MIN_LENGDE} tegn.
              </p>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Gjenta passordet *
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-500 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-50"
              />
            </div>

            {message && (
              <p role="status" className="text-sm text-green-600 dark:text-green-400">{message}</p>
            )}

            {error && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? "Lagrer …" : "Lagre nytt passord"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
