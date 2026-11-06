import { useState } from 'react'
import type { OsUser } from './OsChrome'

export function LoginPage({ onLogin }: { onLogin: (user: OsUser) => void }) {
  const [email, setEmail] = useState('name@uniqube.com')
  const [password, setPassword] = useState('uniqube')
  const [error, setError] = useState<string | null>(null)

  function login() {
    const trimmed = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter a valid work email.')
      return
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters.')
      return
    }
    const local = trimmed.split('@')[0].replace(/[._-]+/g, ' ')
    const name = local.replace(/\b\w/g, (letter) => letter.toUpperCase())
    setError(null)
    onLogin({ name, email: trimmed })
  }

  return (
    <div className="os login">
      <div className="login__card">
        <div className="login__head">
          <img className="login__brand" src="/UniQube_Logo.png" alt="UNIQUBE" />
          <h1>Estimation studio</h1>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            login()
          }}
        >
          <label>
            Work email
            <input type="email" autoComplete="username" value={email} placeholder="name@uniqube.com" onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="os-error">{error}</p>}
          <button type="button" className="os-btn os-btn--primary login__submit" onClick={login}>
            Sign in
          </button>
        </form>
      </div>
    </div>
  )
}
