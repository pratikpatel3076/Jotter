import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authApi } from '@/services/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await authApi.forgotPassword(email.trim())
      setSent(true)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setError(e?.response?.data?.detail ?? 'Failed to send reset link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20">
          <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-extrabold">Jotter</h1>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-surface-1 p-6 shadow-xl">
        {sent ? (
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-950/40">
                <Mail className="h-7 w-7 text-green-400" />
              </div>
            </div>
            <h2 className="mb-2 text-xl font-semibold">Check your email</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              We sent a password reset link to <strong className="text-foreground">{email}</strong>.
              Check your inbox and follow the instructions.
            </p>
            <div className="rounded-xl border border-amber-700/30 bg-amber-950/20 p-3 text-xs text-amber-400 mb-6">
              <strong>Important:</strong> If you use end-to-end encryption, you'll need your recovery key to re-access your existing notes after resetting.
            </div>
            <Link to="/login">
              <Button variant="outline" className="w-full gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to login
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <h2 className="mb-1 text-xl font-semibold">Forgot password?</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Enter your email and we'll send you a reset link.
            </p>

            {error && (
              <div className="mb-4 rounded-xl border border-red-800/40 bg-red-950/30 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="h-4 w-4" />}
                required
              />

              <Button type="submit" size="lg" className="w-full" loading={loading}>
                Send Reset Link
              </Button>
            </form>

            <Link to="/login" className="mt-5 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to login
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
