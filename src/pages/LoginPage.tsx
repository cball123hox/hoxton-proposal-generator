import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Loader2 } from 'lucide-react'
import { HoxtonLogo } from '../components/ui/HoxtonLogo'

export function LoginPage() {
  const { user, loading: authLoading, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-hoxton-deep">
        <Loader2 className="h-8 w-8 animate-spin text-hoxton-mint" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: signInError } = await signIn(email, password)
    if (signInError) {
      setError(signInError.message)
    }
    setLoading(false)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-hoxton-deep overflow-hidden">
      {/* Decorative radial gradients */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-hoxton-turquoise/8 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full bg-hoxton-mint/6 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-hoxton-slate/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo — on dark background above card */}
        <div className="mb-8 flex flex-col items-center">
          <HoxtonLogo size="lg" variant="light" />
          <p className="mt-3 text-sm font-heading font-medium text-hoxton-grey">
            Proposal Generator
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl bg-white p-8 shadow-2xl shadow-black/20">

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="email" className="block text-sm font-heading font-medium text-hoxton-deep">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@hoxtonwealth.com"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-hoxton-grey bg-hoxton-light px-4 py-2.5 text-sm font-body text-hoxton-deep placeholder:text-hoxton-slate/50 focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="block text-sm font-heading font-medium text-hoxton-deep">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-hoxton-grey bg-hoxton-light px-4 py-2.5 text-sm font-body text-hoxton-deep placeholder:text-hoxton-slate/50 focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm font-body text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-hoxton-turquoise px-4 py-2.5 text-sm font-heading font-semibold text-white transition-colors hover:bg-hoxton-turquoise/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              className="text-sm font-body text-hoxton-turquoise hover:underline"
            >
              Forgot password?
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs font-body text-hoxton-slate/60">
          &copy; HoxtonWealth 2026 — Private &amp; Confidential
        </p>
      </div>
    </div>
  )
}
