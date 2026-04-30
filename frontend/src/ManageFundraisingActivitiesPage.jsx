import { useEffect, useState } from 'react'
import { formatApiError } from './apiErrors.js'
import './AdminPage.css'
import './LoginPanel.css'

const FRA_STATUSES = ['draft', 'active', 'paused', 'completed', 'cancelled']

function formatActivityId(id) {
  const n = Number(id)
  if (!Number.isFinite(n)) return String(id ?? '')
  return String(n).padStart(3, '0')
}

function formatDate(iso) {
  if (!iso) return '—'
  const s = String(iso)
  return s.length >= 10 ? s.slice(0, 10) : s
}

function formatMoney(n) {
  if (n == null || n === '') return '—'
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return x.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function dateInputValue(iso) {
  if (!iso) return ''
  const s = String(iso)
  return s.length >= 10 ? s.slice(0, 10) : ''
}

function statusPillClass(status) {
  const s = (status || '').toLowerCase()
  if (s === 'active') return 'fra-pill fra-pill--active'
  if (s === 'draft') return 'fra-pill fra-pill--draft'
  if (s === 'paused') return 'fra-pill fra-pill--paused'
  if (s === 'completed') return 'fra-pill fra-pill--completed'
  if (s === 'cancelled') return 'fra-pill fra-pill--cancelled'
  return 'fra-pill'
}

export function ManageFundraisingActivitiesPage() {
  const [me, setMe] = useState(null)
  const [meError, setMeError] = useState(null)

  const [tab, setTab] = useState('create')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const [nextId, setNextId] = useState(null)
  const [nextIdLoading, setNextIdLoading] = useState(false)

  const [cName, setCName] = useState('')
  const [cDesc, setCDesc] = useState('')
  const [cStatus, setCStatus] = useState('draft')
  const [cStart, setCStart] = useState('')
  const [cEnd, setCEnd] = useState('')
  const [cGoal, setCGoal] = useState('')
  const [creating, setCreating] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')

  const [selected, setSelected] = useState(null)
  const [eName, setEName] = useState('')
  const [eDesc, setEDesc] = useState('')
  const [eStatus, setEStatus] = useState('draft')
  const [eStart, setEStart] = useState('')
  const [eEnd, setEEnd] = useState('')
  const [eGoal, setEGoal] = useState('')
  const [saving, setSaving] = useState(false)

  function parseGoal(str) {
    const t = (str || '').trim()
    if (!t) return null
    const n = Number(t)
    if (!Number.isFinite(n) || n < 0) return null
    return n
  }

  async function loadNextId() {
    const t = localStorage.getItem('access_token')
    if (!t) return
    setNextIdLoading(true)
    try {
      const res = await fetch('/api/fundraiser/activities/next-id', {
        headers: { Authorization: `Bearer ${t}` },
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data && typeof data.next_id === 'number') {
        setNextId(data.next_id)
      }
    } catch {
      /* ignore */
    } finally {
      setNextIdLoading(false)
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
        if (data.is_user_admin || (!data.manage_fra && !data.full_access)) {
          window.location.hash = '#/'
          return
        }
        if (!cancelled) {
          setMe(data)
          loadNextId()
        }
      } catch {
        if (!cancelled) setMeError('Could not load profile.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function loadActivities(q) {
    const t = localStorage.getItem('access_token')
    if (!t) return
    setErr(null)
    setLoading(true)
    try {
      const url = q
        ? `/api/fundraiser/activities?q=${encodeURIComponent(q)}`
        : '/api/fundraiser/activities'
      const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErr(formatApiError(data))
        return
      }
      setItems(Array.isArray(data.activities) ? data.activities : [])
    } catch {
      setErr('Could not load activities.')
    } finally {
      setLoading(false)
    }
  }

  async function createActivity(e) {
    e.preventDefault()
    const t = localStorage.getItem('access_token')
    if (!t) return
    setErr(null)
    const nm = cName.trim()
    if (!nm) {
      setErr('Enter a name.')
      return
    }
    const g = parseGoal(cGoal)
    if ((cGoal || '').trim() !== '' && g === null) {
      setErr('Goal must be a non-negative number.')
      return
    }
    setCreating(true)
    try {
      const body = {
        name: nm,
        description: cDesc,
        status: cStatus,
        start_date: cStart || null,
        end_date: cEnd || null,
        goal_amount: g,
      }
      const res = await fetch('/api/fundraiser/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErr(formatApiError(data))
        return
      }
      setCName('')
      setCDesc('')
      setCStatus('draft')
      setCStart('')
      setCEnd('')
      setCGoal('')
      setTab('list')
      loadNextId()
      await loadActivities('')
    } catch {
      setErr('Could not create activity.')
    } finally {
      setCreating(false)
    }
  }

  function openRow(a) {
    setSelected(a)
    setEName(a.name || '')
    setEDesc(a.description || '')
    setEStatus(a.status || 'draft')
    setEStart(dateInputValue(a.start_date))
    setEEnd(dateInputValue(a.end_date))
    setEGoal(a.goal_amount != null ? String(a.goal_amount) : '')
  }

  function closeRow() {
    setSelected(null)
    setSaving(false)
  }

  async function saveActivity(e) {
    e.preventDefault()
    const t = localStorage.getItem('access_token')
    if (!t || !selected) return
    setErr(null)
    const nm = eName.trim()
    if (!nm) {
      setErr('Enter a name.')
      return
    }
    const g = parseGoal(eGoal)
    if ((eGoal || '').trim() !== '' && g === null) {
      setErr('Goal must be a non-negative number.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/fundraiser/activities/${selected.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({
          name: nm,
          description: eDesc,
          status: eStatus,
          start_date: eStart || null,
          end_date: eEnd || null,
          goal_amount: (eGoal || '').trim() === '' ? null : g,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErr(formatApiError(data))
        return
      }
      setItems((prev) => prev.map((x) => (x.id === data.id ? data : x)))
      setSelected(data)
    } catch {
      setErr('Could not update activity.')
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
          <h1>Fundraising activities</h1>
          <p>
            Create activities, set goals and dates, and keep status up to date. Only your own
            activities are listed.
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
              loadActivities('')
            }}
          >
            Show all
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
            <h2 className="section-title">Create activity</h2>
            <form onSubmit={createActivity}>
              <div className="field">
                <label>Activity ID</label>
                <input
                  type="text"
                  value={
                    nextIdLoading
                      ? 'Loading…'
                      : nextId
                        ? formatActivityId(nextId)
                        : '001'
                  }
                  disabled
                  readOnly
                />
                <p className="field-hint">ID is auto-assigned on create.</p>
              </div>
              <div className="field">
                <label htmlFor="fraName">Name</label>
                <input
                  id="fraName"
                  type="text"
                  required
                  maxLength={200}
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="fraDesc">Description</label>
                <textarea
                  id="fraDesc"
                  rows={3}
                  value={cDesc}
                  onChange={(e) => setCDesc(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="fraSt">Status</label>
                <select id="fraSt" value={cStatus} onChange={(e) => setCStatus(e.target.value)}>
                  {FRA_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="fraStart">Start date</label>
                <input id="fraStart" type="date" value={cStart} onChange={(e) => setCStart(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="fraEnd">End date</label>
                <input id="fraEnd" type="date" value={cEnd} onChange={(e) => setCEnd(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="fraGoal">Goal amount</label>
                <input
                  id="fraGoal"
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 5000.00 (optional)"
                  value={cGoal}
                  onChange={(e) => setCGoal(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={creating}>
                {creating ? 'Creating…' : 'Create activity'}
              </button>
            </form>
          </div>
        )}

        {tab === 'search' && (
          <div className="admin-section">
            <h2 className="section-title">Search</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                loadActivities(searchQuery)
              }}
            >
              <div className="field">
                <label htmlFor="fraSearch">Name, description, or ID</label>
                <input
                  id="fraSearch"
                  type="text"
                  placeholder="e.g. gala or 2"
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
            <h2 className="section-title">Activities</h2>
            {loading ? (
              <p className="subtitle">Loading…</p>
            ) : items.length === 0 ? (
              <p className="subtitle">No results.</p>
            ) : (
              <div className="users-table users-table-4 users-table-fra">
                <div className="users-row users-header users-row-4 users-row-fra">
                  <div>ID</div>
                  <div>Name</div>
                  <div>Status</div>
                  <div>Goal</div>
                  <div>Updated</div>
                </div>
                {items.map((a) => (
                  <div
                    key={a.id}
                    className="users-row users-row-4 users-row-fra users-row-fra-data"
                    role="button"
                    tabIndex={0}
                    aria-label={`Activity ${formatActivityId(a.id)}, ${a.name}`}
                    onClick={() => openRow(a)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openRow(a)
                      }
                    }}
                  >
                    <div className="fra-cell-id">{formatActivityId(a.id)}</div>
                    <div className="users-email fra-cell-name">{a.name}</div>
                    <div className="fra-cell-status">
                      <span className={statusPillClass(a.status)}>{a.status}</span>
                    </div>
                    <div className="fra-cell-goal">{formatMoney(a.goal_amount)}</div>
                    <div className="fra-cell-updated">{formatDate(a.updated_at)}</div>
                  </div>
                ))}
              </div>
            )}

            {selected && (
              <div className="drawer">
                <div className="drawer-header">
                  <div>
                    <div className="drawer-title">Activity #{formatActivityId(selected.id)}</div>
                    <div className="drawer-sub">{selected.name}</div>
                  </div>
                  <button type="button" className="small-button" onClick={closeRow}>
                    Close
                  </button>
                </div>
                <form onSubmit={saveActivity}>
                  <div className="field">
                    <label htmlFor="eName">Name</label>
                    <input
                      id="eName"
                      type="text"
                      value={eName}
                      onChange={(e) => setEName(e.target.value)}
                      required
                      maxLength={200}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="eDesc">Description</label>
                    <textarea id="eDesc" rows={3} value={eDesc} onChange={(e) => setEDesc(e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="eSt">Status</label>
                    <select id="eSt" value={eStatus} onChange={(e) => setEStatus(e.target.value)}>
                      {FRA_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="eStart">Start date</label>
                    <input id="eStart" type="date" value={eStart} onChange={(e) => setEStart(e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="eEnd">End date</label>
                    <input id="eEnd" type="date" value={eEnd} onChange={(e) => setEEnd(e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="eGoal">Goal amount</label>
                    <input
                      id="eGoal"
                      type="text"
                      inputMode="decimal"
                      placeholder="Empty for no goal"
                      value={eGoal}
                      onChange={(e) => setEGoal(e.target.value)}
                    />
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
