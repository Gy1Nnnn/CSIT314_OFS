import './LoginPanel.css'
import './AdminDashboard.css'

export function AdminDashboard({ me, onLogout }) {
  const displayName =
    (me?.name && String(me.name).trim()) || me?.email || 'Administrator'

  return (
    <div className="admin-panel-page">
      <div className="admin-panel-surface">
        <div className="admin-panel-accent" aria-hidden />
        <div className="panel admin-panel">
          <p className="admin-panel-eyebrow">User administration</p>
          <h1 className="admin-panel-title">Welcome, {displayName}</h1>
          <p className="subtitle admin-panel-lead">
            Choose what you want to manage.
          </p>

          <div className="admin-panel-buttons">
            <a className="admin-panel-action" href="#/admin/profiles">
              <span className="admin-panel-action-title">Manage user profiles</span>
              <span className="admin-panel-action-desc">
                Create and edit profiles, access rules, and availability in the sign-in list.
              </span>
            </a>
            <a className="admin-panel-action" href="#/admin/accounts">
              <span className="admin-panel-action-title">Manage user accounts</span>
              <span className="admin-panel-action-desc">
                Add accounts, search by email or ID, and control suspension.
              </span>
            </a>
          </div>

          <button type="button" className="btn-secondary admin-panel-logout" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}
