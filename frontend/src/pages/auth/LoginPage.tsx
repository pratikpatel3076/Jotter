import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'

export default function LoginPage() {
  const { login, googleLogin, loading, error, setError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [shakePassword, setShakePassword] = useState(false)

  useEffect(() => {
    if (!error) return
    setShakePassword(true)
    const timer = window.setTimeout(() => setShakePassword(false), 450)
    return () => window.clearTimeout(timer)
  }, [error])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) return
    await login({ email: email.trim(), password, remember_me: rememberMe })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 shadow-lg shadow-primary/10">
          <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-foreground">Jotter</h1>
          <p className="text-sm text-muted-foreground">Encrypted. Private. Yours.</p>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-surface-1 p-6 shadow-xl animate-auth-card">
        <h2 className="mb-1 text-xl font-semibold">Welcome back</h2>
        <p className="mb-6 text-sm text-muted-foreground">Sign in to access your vault</p>

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
            autoComplete="email"
            required
          />

          <div className={shakePassword ? 'animate-shake' : undefined}>
            <Input
              label="Password"
              type={showPass ? 'text' : 'password'}
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="h-4 w-4" />}
              rightIcon={
                <button type="button" onClick={() => setShowPass(!showPass)} className="cursor-pointer">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
              autoComplete="current-password"
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground/80">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Remember me
            </label>
            <Link to="/forgot-password" className="text-sm text-primary underline-offset-2 transition-colors hover:text-primary/80 hover:underline">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Sign In
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button type="button" variant="outline" size="lg" className="w-full" loading={loading} onClick={() => googleLogin()}>
          Sign in with Google
        </Button>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Don't have an account?{' '}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </p>
      </div>

      <p className="mt-6 max-w-sm text-center text-xs text-muted-foreground/60">
        Your notes are encrypted end-to-end. We never see your content.
      </p>
    </div>
  )
}
