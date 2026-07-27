import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, User, ShieldCheck, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'

export default function SignupPage() {
  const { signup, googleLogin, loading, error, setError } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [savedRecovery, setSavedRecovery] = useState(false)

  const passwordStrength = getPasswordStrength(password)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (!acceptTerms) { setError('Please accept the terms'); return }
    const result = await signup({ full_name: fullName, email, password, confirm_password: confirmPassword })
    if (result) setRecoveryKey(result.recovery_key)
  }

  async function handleGoogleSignup() {
    setError(null)
    const result = await googleLogin()
    if (result?.recovery_key) setRecoveryKey(result.recovery_key)
  }

  async function copyRecoveryKey() {
    if (!recoveryKey) return
    await navigator.clipboard.writeText(recoveryKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (recoveryKey) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-sm rounded-2xl border border-amber-700/40 bg-amber-950/20 p-6 shadow-xl animate-auth-card">
          <SignupStepIndicator step={2} />
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
              <ShieldCheck className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Save your Recovery Key</h2>
              <p className="text-xs text-amber-400">You won't see this again!</p>
            </div>
          </div>

          <p className="mb-4 text-sm text-muted-foreground">
            This key can recover your encrypted notes if you forget your password.
            Store it somewhere safe — a password manager, printed paper, or offline backup.
          </p>

          <div className="mb-4 rounded-xl border border-amber-700/30 bg-surface-2 p-3">
            <code className="break-all text-xs font-mono text-amber-300">{recoveryKey}</code>
          </div>

          <Button variant="outline" size="sm" onClick={copyRecoveryKey} className="mb-4 w-full gap-2">
            {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </Button>

          <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={savedRecovery}
              onChange={(e) => setSavedRecovery(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-foreground/80">I have saved my recovery key securely</span>
          </label>

          <Button
            className="w-full"
            disabled={!savedRecovery}
            onClick={() => window.location.href = '/dashboard'}
          >
            Continue to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 shadow-lg shadow-primary/10">
          <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-foreground">Jotter</h1>
          <p className="text-sm text-muted-foreground">Create your encrypted vault</p>
        </div>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-surface-1 p-6 shadow-xl animate-auth-card">
        <SignupStepIndicator step={1} />
        <h2 className="mb-1 text-xl font-semibold">Create account</h2>
        <p className="mb-6 text-sm text-muted-foreground">Start your private notes experience</p>

        {error && (
          <div className="mb-4 rounded-xl border border-red-800/40 bg-red-950/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            type="text"
            placeholder="John Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            leftIcon={<User className="h-4 w-4" />}
            autoComplete="name"
            required
          />

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

          <div className="space-y-1.5">
            <Input
              label="Password"
              type={showPass ? 'text' : 'password'}
              placeholder="Create strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="h-4 w-4" />}
              rightIcon={
                <button type="button" onClick={() => setShowPass(!showPass)} className="cursor-pointer">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
              autoComplete="new-password"
              required
            />
            {password && (
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i <= passwordStrength.score
                        ? passwordStrength.color
                        : 'bg-surface-3'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          <Input
            label="Confirm Password"
            type={showPass ? 'text' : 'password'}
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            leftIcon={<Lock className="h-4 w-4" />}
            error={confirmPassword && confirmPassword !== password ? 'Passwords do not match' : undefined}
            autoComplete="new-password"
            required
          />

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span className="text-foreground/80">
              I agree to the{' '}
              <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
            </span>
          </label>

          <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!acceptTerms}>
            Create Account
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button type="button" variant="outline" size="lg" className="w-full" loading={loading} onClick={handleGoogleSignup}>
          Signup with Google
        </Button>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' }
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score++
  const labels = ['Weak', 'Fair', 'Good', 'Strong']
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500']
  return { score, label: labels[score - 1] ?? '', color: colors[score - 1] ?? 'bg-surface-3' }
}

function SignupStepIndicator({ step }: { step: 1 | 2 }) {
  const items = ['Fill form', 'Save key']
  return (
    <div className="mb-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      {items.map((label, index) => {
        const active = step >= index + 1
        return (
          <div key={label} className="contents">
            <div className="flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${active ? 'bg-primary text-white' : 'bg-surface-3 text-muted-foreground'}`}>
                {index + 1}
              </span>
              <span className={`text-xs ${active ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
            </div>
            {index === 0 && <div className={`h-px w-8 ${step === 2 ? 'bg-primary' : 'bg-border'}`} />}
          </div>
        )
      })}
    </div>
  )
}
