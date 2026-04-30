import { useEffect, useState } from 'react'
import { formatHttpError } from './apiErrors.js'
import './LoginPanel.css'

export function LoginPanel() {
  const [profileName, setProfileName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [profilesLoading, setProfilesLoading] = useState(true)
  const [profileList, setProfileList] = useState([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/public/profiles')
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (!cancelled) setProfileList([])
          return
        }
        const list = Array.isArray(data.profiles) ? data.profiles : []
        if (!cancelled) setProfileList(list)
      } catch {
        if (!cancelled) setProfileList([])
      } finally {
        if (!cancelled) setProfilesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!profileName) {
      setError('Choose a profile from “Log in as”.')
      return
    }
    setLoading(true)
    const path = '/api/login'
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, profile_name: profileName }),
      })
      const rawText = await res.text()
      let data = {}
      try {
        data = rawText ? JSON.parse(rawText) : {}
      } catch {
        data = {}
      }
      if (!res.ok) {
        setError(formatHttpError(res, rawText, data))
        return
      }
      if (data.access_token) localStorage.setItem('access_token', data.access_token)
      const u = data.user
      if (u && !u.is_user_admin && (u.manage_fra || u.full_access)) {
        window.location.hash = '#/fundraiser/activities'
      } else {
        window.location.hash = '#/'
      }
    } catch {
      setError('Could not reach the server. Is the Python API running on port 8000?')
    } finally {
      setLoading(false)
    }
  }

  function onCancel() {
    window.location.hash = '#/'
  }

  return (
    <div className="panel">
      <h1>Log in</h1>
      <p className="subtitle">Sign in to your account</p>

      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="role">Log in as</label>
          <select
            id="role"
            name="role"
            required
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            disabled={profilesLoading}
          >
            <option value="" disabled>
              {profilesLoading ? 'Loading profiles…' : 'Select a profile…'}
            </option>
            {profileList.map((p) => (
              <option key={p.id} value={p.profile_name}>
                {p.profile_name}
              </option>
            ))}
          </select>
          {!profilesLoading && profileList.length === 0 && (
            <p className="field-hint">No profiles are available yet. Ask an administrator to create profiles.</p>
          )}
        </div>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="auth-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading || profilesLoading}>
            {loading ? 'Signing in…' : 'Log in'}
          </button>
        </div>
      </form>
    </div>
  )
}
