import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { csrfHeaders } from './api'
export interface Profile { email: string; name: string; role: 'USER' | 'TECHNICIAN' | 'ADMIN' }
export default function Auth({ children }: { children: (user: Profile, logout: () => Promise<void>) => ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [register, setRegister] = useState(false)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  async function profile() {
    const response = await fetch('/api/auth/me', {signal: AbortSignal.timeout(15000)})
    if (response.status === 401) return null
    if (!response.ok) throw new Error('Cannot connect. Start the updated backend and try again.')
    return response.json() as Promise<Profile>
  }
  useEffect(() => {
    let active = true
    profile().then(user => { if (active) setUser(user) })
      .catch(error => { if (active) setError(error.message) })
      .finally(() => { if (active) setChecking(false) })
    function expired() { setUser(null); setError('Your session expired. Please sign in again.') }
    window.addEventListener('session-expired', expired)
    return () => { active = false; window.removeEventListener('session-expired', expired) }
  }, [])
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      if (register) {
        const response = await fetch('/api/auth/register', {method:'POST', headers:{'Content-Type':'application/json', ...await csrfHeaders()}, body:JSON.stringify({email:email.trim(), name:name.trim(), password}), signal:AbortSignal.timeout(15000)})
        if (!response.ok) throw new Error(response.status === 409 ? 'This email is registered. Switch to sign in.' : 'Registration failed. Use a valid email, a name, and a password of 8 to 72 bytes.')
        setRegister(false); setPassword(''); setError('Account created. Sign in with your new password.'); return
      }
      const response = await fetch('/api/auth/login', {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded', ...await csrfHeaders()}, body:new URLSearchParams({username:email.trim().toLowerCase(), password}), signal:AbortSignal.timeout(15000)})
      if (!response.ok) throw new Error(response.status === 401 ? 'Email or password is incorrect.' : 'Sign in failed. Please retry.')
      const current = await profile()
      if (!current) throw new Error('Sign in was not completed. Please retry.')
      setUser(current); setPassword('')
    } catch(error) { setError((error as Error).message) }
    finally { setBusy(false) }
  }
  async function logout() {
    const response = await fetch('/api/auth/logout', {method:'POST', headers:await csrfHeaders(), signal:AbortSignal.timeout(15000)})
    if (!response.ok) throw new Error('Could not sign out. Please retry.')
    setUser(null); setPassword(''); setError(''); setRegister(false)
  }
  if (checking) return <main className="empty" role="status">Checking your session...</main>
  if (user) return children(user, logout)
  return <main className="auth-layout"><div className="auth-intro"><div className="brand"><span className="brand-icon">F</span>FixFlow</div><h1>A better space starts with you.</h1><p className="muted">Report a problem, follow its progress, and keep your maintenance requests in one place.</p></div><section className="panel auth-card"><div className="eyebrow">YOUR MAINTENANCE WORKSPACE</div><h2>{register ? 'Create your account' : 'Welcome back'}</h2><p className="muted">{register ? 'Get started with your first report.' : 'Sign in to view your issues.'}</p><form onSubmit={submit}>
    <fieldset disabled={busy}>{register && <><label htmlFor="name">Name</label><input id="name" autoComplete="name" required maxLength={100} value={name} onChange={e => setName(e.target.value)}/></>}
    <label htmlFor="email">Email</label><input id="email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)}/>
    <label htmlFor="password">Password</label><input id="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 8 : undefined} maxLength={72} required value={password} onChange={e => setPassword(e.target.value)}/>
    {register && <p className="hint">Use at least 8 characters (up to 72 UTF-8 bytes).</p>}<button className="primary wide">{busy ? 'Please wait...' : register ? 'Create account' : 'Sign in'}</button></fieldset><p className="feedback" role="status">{error}</p></form>
    <button disabled={busy} className="text-button auth-switch" onClick={() => {setRegister(!register); setError(''); setPassword('')}}>{register ? 'Already registered? Sign in' : 'New here? Create an account'}</button></section></main>
}
