import { useEffect, useState } from 'react'
import { formatApiError } from './apiErrors.js'
import './AdminPage.css'
import './LoginPanel.css'

const DEFAULT_ACCESS = {
  full_access: false,
  manage_fra: false,
  partial_access: false,
  manage_platform: false,
}

const ACCESS_CHECKS = [
  {
    key: 'full_access',
    label: 'Full access',
    hint: 'Broad platform capabilities aligned with this profile’s responsibilities.',
  },
  {
    key: 'manage_fra',
    label: 'Manage FRA',
    hint: 'Fundraising-related actions such as campaigns and donor-facing workflows.',
  },
  {
    key: 'partial_access',
    label: 'Partial access',
    hint: 'A constrained set of actions for contributors who do not need full access.',
  },
  {
    key: 'manage_platform',
    label: 'Manage platform',
    hint: 'Administrative and platform-wide configuration where applicable.',
  },
]

function AccessControlGrid({ value, onChange }) {
  return (
    <div className="access-control-grid" role="group" aria-label="Access control">
      {ACCESS_CHECKS.map((c) => (
        <label
          key={c.key}
          className={`access-option ${value[c.key] ? 'is-on' : ''}`}
        >
          <input
            type="checkbox"
            className="access-option-input"
            checked={Boolean(value[c.key])}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, [c.key]: e.target.checked }))
            }
          />
          <span className="access-option-check" aria-hidden />
          <span className="access-option-body">
            <span className="access-option-title">{c.label}</span>
            <span className="access-option-hint">{c.hint}</span>
          </span>
        </label>
      ))}
    </div>
  )
}

function formatProfileAccess(p) {
  const parts = []
  if (p.full_access) parts.push('Full')
  if (p.manage_fra) parts.push('Manage FRA')
  if (p.partial_access) parts.push('Partial')
  if (p.manage_platform) parts.push('Manage platform')
  return parts.join(', ')
}

function isSameProfileAsMe(me, profileRole) {
  return Boolean(
    me &&
      profileRole &&
      me.profile_name &&
      me.profile_name.toLowerCase() === profileRole.toLowerCase(),
  )
}

export function ManageProfilesPage() {
  const [me, setMe] = useState(null)
  const [meError, setMeError] = useState(null)

  const [adminTab, setAdminTab] = useState('create')
  const [profiles, setProfiles] = useState([])
  const [profilesLoading, setProfilesLoading] = useState(false)
  const [profilesError, setProfilesError] = useState(null)

  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createAccess, setCreateAccess] = useState({ ...DEFAULT_ACCESS })
  const [creatingProfile, setCreatingProfile] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')

  const [nextProfileId, setNextProfileId] = useState(null)
  const [nextProfileIdLoading, setNextProfileIdLoading] = useState(false)

  const [selectedProfile, setSelectedProfile] = useState(null)
  const [editName, setEditName] = useState('')
  const [editSuspended, setEditSuspended] = useState(false)
  const [editDescription, setEditDescription] = useState('')
  const [editAccess, setEditAccess] = useState({ ...DEFAULT_ACCESS })
  const [savingProfile, setSavingProfile] = useState(false)

  function formatProfileId(id) {
    const n = Number(id)
    if (!Number.isFinite(n)) return String(id ?? '')
    return String(n).padStart(3, '0')
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
        if (!cancelled) loadNextProfileId()
      } catch {
        if (!cancelled) setMeError('Could not load profile.')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  async function loadNextProfileId() {
    const t = localStorage.getItem('access_token')
    if (!t) return
    setNextProfileIdLoading(true)
    try {
      const res = await fetch('/api/admin/profiles/next-id', {
        headers: { Authorization: `Bearer ${t}` },
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data && typeof data.next_id === 'number') {
        setNextProfileId(data.next_id)
      }
    } catch {
      /* ignore */
    } finally {
      setNextProfileIdLoading(false)
    }
  }

  async function loadProfile(q) {
    const t = localStorage.getItem('access_token')
    if (!t) return
    setProfilesError(null)
    setProfilesLoading(true)
    try {
      const url = q
        ? `/api/admin/profiles?q=${encodeURIComponent(q)}`
        : '/api/admin/profiles'
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${t}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setProfilesError(formatApiError(data))
        return
      }
      setProfiles(Array.isArray(data.profiles) ? data.profiles : [])
    } catch {
      setProfilesError('Could not load profiles.')
    } finally {
      setProfilesLoading(false)
    }
  }

  async function createProfile(e) {
    e.preventDefault()
    const t = localStorage.getItem('access_token')
    if (!t) return
    setProfilesError(null)
    const name = createName.trim()
    if (!name) {
      setProfilesError('Enter a profile name.')
      return
    }

    setCreatingProfile(true)
    try {
      const res = await fetch('/api/admin/profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({
          profile_name: name,
          description: createDescription,
          ...createAccess,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setProfilesError(formatApiError(data))
        return
      }
      setCreateName('')
      setCreateDescription('')
      setCreateAccess({ ...DEFAULT_ACCESS })
      setAdminTab('list')
      loadNextProfileId()
      await loadProfile('')
    } catch {
      setProfilesError('Could not create profile.')
    } finally {
      setCreatingProfile(false)
    }
  }

  function openProfile(p) {
    setSelectedProfile(p)
    setEditName(p.profile_name || '')
    setEditSuspended(Boolean(p.suspended))
    setEditDescription(p.description || '')
    setEditAccess({
      full_access: Boolean(p.full_access),
      manage_fra: Boolean(p.manage_fra),
      partial_access: Boolean(p.partial_access),
      manage_platform: Boolean(p.manage_platform),
    })
  }

  function closeProfile() {
    setSelectedProfile(null)
    setSavingProfile(false)
  }

  async function saveProfile(e) {
    e.preventDefault()
    const t = localStorage.getItem('access_token')
    if (!t || !selectedProfile) return
    const name = editName.trim()
    if (!name) {
      setProfilesError('Enter a profile name.')
      return
    }
    setProfilesError(null)
    setSavingProfile(true)
    try {
      const res = await fetch(`/api/admin/profiles/${selectedProfile.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({
          profile_name: name,
          suspended: editSuspended,
          description: editDescription,
          ...editAccess,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setProfilesError(formatApiError(data))
        return
      }
      setProfiles((prev) => prev.map((x) => (x.id === data.id ? data : x)))
      setSelectedProfile(data)
    } catch {
      setProfilesError('Could not update profile.')
    } finally {
      setSavingProfile(false)
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
          <h1>User profiles</h1>
          <p>
            Create named profiles with descriptions and access rules. Each profile appears in the
            login dropdown. Search by profile name, or suspend and update as needed.
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
            className={adminTab === 'create' ? 'tab-button active' : 'tab-button'}
            onClick={() => setAdminTab('create')}
          >
            Create
          </button>
          <button
            type="button"
            className={adminTab === 'list' ? 'tab-button active' : 'tab-button'}
            onClick={() => {
              setAdminTab('list')
              loadProfile('')
            }}
          >
            Show all profiles
          </button>
          <button
            type="button"
            className={adminTab === 'search' ? 'tab-button active' : 'tab-button'}
            onClick={() => setAdminTab('search')}
          >
            Search
          </button>
        </div>

        {profilesError && <p className="form-error">{profilesError}</p>}

        {adminTab === 'create' && (
          <div className="admin-section profile-create-section">
            <h2 className="section-title profile-create-intro">Create User Profile</h2>
            <form className="profile-create-form" onSubmit={createProfile}>
              <div className="field">
                <label>Profile ID</label>
                <input
                  type="text"
                  value={
                    nextProfileIdLoading
                      ? 'Loading…'
                      : nextProfileId
                        ? formatProfileId(nextProfileId)
                        : '001'
                  }
                  disabled
                  readOnly
                />
                <p className="field-hint">Profile ID is auto-assigned on create.</p>
              </div>

              <div className="profile-field-group profile-field-group--stack">
                <label className="profile-field-label" htmlFor="createName">
                  Name
                </label>
                <input
                  id="createName"
                  type="text"
                  className="profile-text-input"
                  autoComplete="off"
                  maxLength={128}
                  placeholder="e.g. Fundraiser"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  required
                />
              </div>

              <div className="profile-field-group profile-field-group--stack">
                <label className="profile-field-label" htmlFor="createDescription">
                  Description
                </label>
                <textarea
                  id="createDescription"
                  rows={4}
                  className="profile-text-input profile-textarea"
                  placeholder="Briefly describe this profile’s purpose, scope, and who it applies to."
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                />
              </div>

              <div className="profile-field-group profile-field-group--stack">
                <label className="profile-field-label">Access control</label>
                <p className="profile-field-help">
                  Choose which capabilities this profile may use.
                </p>
                <AccessControlGrid value={createAccess} onChange={setCreateAccess} />
              </div>

              <div className="profile-form-actions">
                <button type="submit" className="btn-primary" disabled={creatingProfile}>
                  {creatingProfile ? 'Creating…' : 'Create profile'}
                </button>
              </div>
            </form>
          </div>
        )}

        {adminTab === 'search' && (
          <div className="admin-section">
            <h2 className="section-title">Search profiles</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                loadProfile(searchQuery)
              }}
            >
              <div className="field">
                <label htmlFor="searchQuery">Profile name</label>
                <input
                  id="searchQuery"
                  type="text"
                  placeholder="e.g. part of the profile name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={profilesLoading}>
                {profilesLoading ? 'Searching…' : 'Search'}
              </button>
            </form>
          </div>
        )}

        {(adminTab === 'list' || adminTab === 'search') && (
          <div className="admin-section">
            <h2 className="section-title">Profiles</h2>
            {profilesLoading ? (
              <p className="subtitle">Loading…</p>
            ) : profiles.length === 0 ? (
              <p className="subtitle">No results.</p>
            ) : (
              <div className="users-table users-table-4 users-table-profiles">
                <div className="users-row users-header users-row-4">
                  <div>ID</div>
                  <div>Name</div>
                  <div>Status</div>
                  <div>Access</div>
                </div>
                {profiles.map((p) => (
                  <div
                    key={p.id}
                    className="users-row users-row-4 users-row-profiles-data"
                    role="button"
                    tabIndex={0}
                    aria-label={`Profile ${formatProfileId(p.id)}, ${p.profile_name}`}
                    onClick={() => openProfile(p)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openProfile(p)
                      }
                    }}
                  >
                    <div className="profiles-cell-id">{formatProfileId(p.id)}</div>
                    <div className="users-email profiles-cell-name">{p.profile_name}</div>
                    <div className="profiles-cell-status">
                      <span className={p.suspended ? 'status-pill suspended' : 'status-pill active'}>
                        {p.suspended ? 'Suspended' : 'Active'}
                      </span>
                    </div>
                    <div className="profiles-cell-access">{formatProfileAccess(p)}</div>
                  </div>
                ))}
              </div>
            )}

            {selectedProfile && (
              <div className="drawer">
                <div className="drawer-header">
                  <div>
                    <div className="drawer-title">
                      Profile #{formatProfileId(selectedProfile.id)}
                    </div>
                    <div className="drawer-sub">{selectedProfile.profile_name}</div>
                  </div>
                  <button type="button" className="table-action-btn table-action-btn--neutral" onClick={closeProfile}>
                    Close
                  </button>
                </div>

                <form className="profile-create-form" onSubmit={saveProfile}>
                  <div className="profile-field-group profile-field-group--stack">
                    <label className="profile-field-label" htmlFor="editName">
                      Name
                    </label>
                    <input
                      id="editName"
                      type="text"
                      className="profile-text-input"
                      maxLength={128}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="field">
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={editSuspended}
                        disabled={Boolean(
                          selectedProfile &&
                            isSameProfileAsMe(me, selectedProfile.profile_name) &&
                            !editSuspended,
                        )}
                        title={
                          selectedProfile &&
                            isSameProfileAsMe(me, selectedProfile.profile_name) &&
                            !editSuspended
                            ? 'You cannot suspend your own profile'
                            : undefined
                        }
                        onChange={(e) => setEditSuspended(e.target.checked)}
                      />
                      Suspended
                    </label>
                  </div>

                  <div className="profile-field-group profile-field-group--stack">
                    <label className="profile-field-label" htmlFor="editDescription">
                      Description
                    </label>
                    <textarea
                      id="editDescription"
                      rows={3}
                      className="profile-text-input profile-textarea"
                      placeholder="Briefly describe this profile’s purpose, scope, and who it applies to."
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                    />
                  </div>

                  <div className="profile-field-group profile-field-group--stack">
                    <label className="profile-field-label">Access control</label>
                    <p className="profile-field-help">Adjust capabilities for this profile.</p>
                    <AccessControlGrid value={editAccess} onChange={setEditAccess} />
                  </div>

                  <div className="profile-form-actions">
                    <button
                      type="submit"
                      className="btn-primary profile-save-changes-btn"
                      disabled={savingProfile}
                    >
                      {savingProfile ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
