import { useEffect, useState } from 'react'
import { formatApiError } from './apiErrors.js'
import './AdminPage.css'
import './LoginPanel.css'

export function ManageAccountsPage() {
  const [me, setMe] = useState(null)
  const [meError, setMeError] = useState(null)

  const [tab, setTab] = useState('create')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const [nextUserId, setNextUserId] = useState(null)
  const [nextUserIdLoading, setNextUserIdLoading] = useState(false)

  const [createName, setCreateName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createPassword2, setCreatePassword2] = useState('')
  const [createProfileId, setCreateProfileId] = useState('')
  const [creating, setCreating] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')

  const [selected, setSelected] = useState(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editProfileId, setEditProfileId] = useState('')
  const [editSuspended, setEditSuspended] = useState(false)
  const [saving, setSaving] = useState(false)
  const [profileOptions, setProfileOptions] = useState([])
  const [profilesLoading, setProfilesLoading] = useState(true)

  function formatUserId(id) {
    const n = Number(id)
    if (!Number.isFinite(n)) return String(id ?? '')
    return String(n).padStart(3, '0')
  }

  function getProfileIdForUser(u) {
    if (u?.profile_id != null) return String(u.profile_id)
    const match = profileOptions.find((p) => p.profile_name === u?.profile_name)
    return match ? String(match.id) : ''
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/public/profiles')
        const data = await res.json().catch(() => ({}))
        if (res.ok && Array.isArray(data.profiles)) {
          if (!cancelled) setProfileOptions(data.profiles)
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setProfilesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function loadNextUserId() {
    const t = localStorage.getItem('access_token')
    if (!t) return
    setNextUserIdLoading(true)
    try {
      const res = await fetch('/api/admin/users/next-id', {
        headers: { Authorization: `Bearer ${t}` },
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data && typeof data.next_id === 'number') {
        setNextUserId(data.next_id)
      }
    } catch {
      /* ignore */
    } finally {
      setNextUserIdLoading(false)
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      window.location.hash = '#/login'
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (!cancelled) setMeError(formatApiError(data))
          return
        }
        if (!data.is_user_admin) {
          window.location.hash = '#/'
          return
        }
        if (!cancelled) setMe(data)
        if (!cancelled) loadNextUserId()
      } catch {
        if (!cancelled) setMeError('Could not load profile.')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  async function loadUsers(q) {
    const t = localStorage.getItem('access_token')
    if (!t) return
    setErr(null)
    setLoading(true)
    try {
      const url = q ? `/api/admin/users?q=${encodeURIComponent(q)}` : '/api/admin/users'
      const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErr(formatApiError(data))
        return
      }
      setUsers(Array.isArray(data.users) ? data.users : [])
    } catch {
      setErr('Could not load accounts.')
    } finally {
      setLoading(false)
    }
  }

  async function createAccount(e) {
    e.preventDefault()
    const t = localStorage.getItem('access_token')
    if (!t) return
    setErr(null)
    const nm = createName.trim()
    if (!nm) {
      setErr('Enter a name.')
      return
    }
    if (!createProfileId) {
      setErr('Choose a profile.')
      return
    }
    if (createPassword.length < 8) {
      setErr('Password must be at least 8 characters.')
      return
    }
    if (createPassword !== createPassword2) {
      setErr('Passwords do not match.')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({
          name: nm,
          email: createEmail,
          password: createPassword,
          profile_id: Number(createProfileId),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErr(formatApiError(data))
        return
      }
      setCreateName('')
      setCreateEmail('')
      setCreatePassword('')
      setCreatePassword2('')
      setCreateProfileId('')
      setTab('list')
      loadNextUserId()
      await loadUsers('')
    } catch {
      setErr('Could not create account.')
    } finally {
      setCreating(false)
    }
  }

  function openUser(u) {
    setSelected(u)
    setEditName(u.name || '')
    setEditEmail(u.email || '')
    setEditProfileId(getProfileIdForUser(u))
    setEditSuspended(Boolean(u.suspended))
  }

  function closeUser() {
    setSelected(null)
    setSaving(false)
  }

  async function saveUser(e) {
    e.preventDefault()
    const t = localStorage.getItem('access_token')
    if (!t || !selected) return
    setErr(null)
    const nm = editName.trim()
    if (!nm) {
      setErr('Enter a name.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${selected.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({
          name: nm,
          email: editEmail,
          profile_id: Number(editProfileId),
          suspended: editSuspended,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErr(formatApiError(data))
        return
      }
      setUsers((prev) => prev.map((x) => (x.id === data.id ? data : x)))
      setSelected(data)
    } catch {
      setErr('Could not update account.')
    } finally {
      setSaving(false)
    }
  }

  function logout() {
    localStorage.removeItem('access_token')
    window.location.hash = '#/'
    window.location.reload()
  }

  return (
    <div className="admin-page">
      <div className="admin-hero">
        <div>
          <h1>User accounts</h1>
          <p>
            Create sign-in accounts (email and password), list all accounts, or search by email
            or user ID.
          </p>
          {me && (
            <p className="admin-me">
              Signed in as <strong>{me.email}</strong>
            </p>
          )}
          {meError && <p className="form-error">{meError}</p>}
        </div>
        <div className="admin-hero-actions">
          <button type="button" className="btn-secondary" onClick={logout}>
            Log out
          </button>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-tabs">
          <button
            type="button"
            className={tab === 'create' ? 'tab-button active' : 'tab-button'}
            onClick={() => setTab('create')}
          >
            Create
          </button>
          <button
            type="button"
            className={tab === 'list' ? 'tab-button active' : 'tab-button'}
            onClick={() => {
              setTab('list')
              loadUsers('')
            }}
          >
            Show all accounts
          </button>
          <button
            type="button"
            className={tab === 'search' ? 'tab-button active' : 'tab-button'}
            onClick={() => setTab('search')}
          >
            Search
          </button>
        </div>

        {err && <p className="form-error">{err}</p>}

        {tab === 'create' && (
          <div className="admin-section">
            <h2 className="section-title">Create account</h2>
            <form onSubmit={createAccount}>
              <div className="field">
                <label>User ID</label>
                <input
                  type="text"
                  value={
                    nextUserIdLoading
                      ? 'Loading…'
                      : nextUserId
                        ? formatUserId(nextUserId)
                        : '001'
                  }
                  disabled
                  readOnly
                />
                <p className="field-hint">User ID is auto-assigned on create.</p>
              </div>
              <div className="field">
                <label htmlFor="accName">Name</label>
                <input
                  id="accName"
                  type="text"
                  required
                  maxLength={120}
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="accRole">Profile</label>
                <select
                  id="accRole"
                  value={createProfileId}
                  onChange={(e) => setCreateProfileId(e.target.value)}
                  required
                  disabled={profilesLoading}
                >
                  <option value="" disabled>
                    {profilesLoading ? 'Loading profiles…' : 'Select a profile…'}
                  </option>
                  {profileOptions.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.profile_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="accEmail">Email</label>
                <input
                  id="accEmail"
                  type="email"
                  required
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="accPassword">Password</label>
                <input
                  id="accPassword"
                  type="password"
                  required
                  minLength={8}
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  autoComplete="new-password"
                />
                <p className="field-hint">At least 8 characters.</p>
              </div>
              <div className="field">
                <label htmlFor="accPassword2">Re-type Password</label>
                <input
                  id="accPassword2"
                  type="password"
                  required
                  minLength={8}
                  value={createPassword2}
                  onChange={(e) => setCreatePassword2(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <button type="submit" className="btn-primary" disabled={creating || profilesLoading}>
                {creating ? 'Creating…' : 'Create account'}
              </button>
            </form>
          </div>
        )}

        {tab === 'search' && (
          <div className="admin-section">
            <h2 className="section-title">Search accounts</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                loadUsers(searchQuery)
              }}
            >
              <div className="field">
                <label htmlFor="accSearch">Email or User ID</label>
                <input
                  id="accSearch"
                  type="text"
                  placeholder="e.g. 3 or user@example.com"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Searching…' : 'Search'}
              </button>
            </form>
          </div>
        )}

        {(tab === 'list' || tab === 'search') && (
          <div className="admin-section">
            <h2 className="section-title">Accounts</h2>
            {loading ? (
              <p className="subtitle">Loading…</p>
            ) : users.length === 0 ? (
              <p className="subtitle">No results.</p>
            ) : (
              <div className="users-table users-table-4 users-table-accounts">
                <div className="users-row users-header users-row-4 users-row-accounts">
                  <div>ID</div>
                  <div>Name</div>
                  <div>Email</div>
                  <div>Profile</div>
                  <div>Status</div>
                </div>
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="users-row users-row-4 users-row-accounts users-row-accounts-data"
                    role="button"
                    tabIndex={0}
                    aria-label={`Account ${formatUserId(u.id)}, ${u.email}`}
                    onClick={() => openUser(u)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openUser(u)
                      }
                    }}
                  >
                    <div className="accounts-cell-id">{formatUserId(u.id)}</div>
                    <div className="users-name accounts-cell-name">{u.name?.trim() ? u.name : '—'}</div>
                    <div className="users-email accounts-cell-email">{u.email}</div>
                    <div className="accounts-cell-profile">{u.profile_name}</div>
                    <div className="accounts-cell-status">
                      <span className={u.suspended ? 'status-pill suspended' : 'status-pill active'}>
                        {u.suspended ? 'Suspended' : 'Active'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selected && (
              <div className="drawer">
                <div className="drawer-header">
                  <div>
                    <div className="drawer-title">Account #{formatUserId(selected.id)}</div>
                    <div className="drawer-sub">{selected.name || selected.email}</div>
                  </div>
                  <button type="button" className="small-button" onClick={closeUser}>
                    Close
                  </button>
                </div>
                <form onSubmit={saveUser}>
                  <div className="field">
                    <label htmlFor="editName">Name</label>
                    <input
                      id="editName"
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      maxLength={120}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="editEmail">Email</label>
                    <input
                      id="editEmail"
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="editRoleAcc">Profile</label>
                    <select
                      id="editRoleAcc"
                      value={editProfileId}
                      onChange={(e) => setEditProfileId(e.target.value)}
                      required
                      disabled={profilesLoading}
                    >
                      {editProfileId && !profileOptions.some((p) => String(p.id) === String(editProfileId)) && (
                        <option value={editProfileId}>Unknown profile</option>
                      )}
                      {profileOptions.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.profile_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={editSuspended}
                        disabled={Boolean(selected && me && selected.id === me.id && !editSuspended)}
                        title={
                          selected && me && selected.id === me.id && !editSuspended
                            ? 'You cannot suspend your own account'
                            : undefined
                        }
                        onChange={(e) => setEditSuspended(e.target.checked)}
                      />
                      Suspended
                    </label>
                  </div>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
