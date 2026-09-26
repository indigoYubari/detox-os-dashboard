"use client"

import { supabase } from "@/lib/supabase"
import { useRouter, useSearchParams } from "next/navigation"
import React from "react"

export default function UpdatePasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [token, setToken] = React.useState<string | null>(null)

  // When Supabase redirects back, it adds `access_token` and `refresh_token` to the URL.
  // We need to explicitly check for these to ensure the user is authenticated for the password update.
  React.useEffect(() => {
    const accessToken = searchParams.get("access_token")
    const refreshToken = searchParams.get("refresh_token")

    if (accessToken && refreshToken) {
      // Set the session with the tokens from the URL
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      setToken(accessToken)
    } else {
      // If no tokens are present, something went wrong or the user landed here directly.
      // Redirect to login or show an error.
      setError("Ugyldig lenke for passordtilbakestilling. Vennligst prøv igjen.")
      setLoading(false)
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)

    if (password !== confirmPassword) {
      setError("Passordene stemmer ikke overens.")
      setLoading(false)
      return
    }

    if (!token) {
        setError("Ingen gyldig sesjon. Vennligst prøv tilbakestilling på nytt.")
        setLoading(false)
        return
    }

    const { error } = await supabase.auth.updateUser({
      password: password,
    })

    if (error) {
      setError("Kunne ikke oppdatere passord. Vennligst prøv igjen.")
    } else {
      setMessage("Passordet ditt er oppdatert! Du kan nå logge inn.")
      // Optionally redirect to login after a short delay
      setTimeout(() => {
        router.push("/login")
      }, 3000)
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
            Oppdater passord
          </h1>
          <p className="mt-1 text-sm text-gray-500">detox.OS</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="space-y-4">
            {!token && error ? (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : (
                <>
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
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-gray-500 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-50"
                    />
                    </div>

                    <div>
                    <label
                        htmlFor="confirmPassword"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        Bekreft passord *
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
                    <p className="text-sm text-green-600 dark:text-green-400">{message}</p>
                    )}

                    {error && (
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    )}

                    <button
                    type="submit"
                    disabled={loading || !token}
                    className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                    {loading ? "Oppdaterer passord…" : "Oppdater passord"}
                    </button>
                </>
            )}
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
