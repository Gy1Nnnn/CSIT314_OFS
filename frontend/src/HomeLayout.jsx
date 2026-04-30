import { useEffect, useLayoutEffect, useState } from 'react'
import { Layout } from './Layout.jsx'
import { HomePage } from './HomePage.jsx'
import { AdminDashboard } from './AdminDashboard.jsx'
import './HomeLayout.css'

function homeLogout() {
  localStorage.removeItem('access_token')
  window.location.hash = '#/'
  window.location.reload()
}

export function HomeLayout() {
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setLoading(false)
      setMe(null)
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
          if (!cancelled) setMe(null)
          return
        }
        if (!cancelled) setMe(data)
      } catch {
        if (!cancelled) setMe(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const isAdmin = Boolean(me?.is_user_admin)
  const isFundraiser =
    Boolean(
      me &&
        !me.is_user_admin &&
        (me.manage_fra || me.full_access),
    )

  useLayoutEffect(() => {
    if (loading || !me || isAdmin) return
    if (isFundraiser) {
      window.location.hash = '#/fundraiser/activities'
    }
  }, [loading, me, isAdmin, isFundraiser])

  const headerLeft = (
    <>
      <a className="nav-link" href="#/">
        Donate
      </a>
      <a className="nav-link" href="#/">
        Fundraise
      </a>
    </>
  )

  const headerRight =
    loading ? (
      <span className="nav-muted" aria-hidden />
    ) : isAdmin ? (
      <>
        <span className="nav-pill">Administrator</span>
        <button type="button" className="nav-link-button" onClick={homeLogout}>
          Log out
        </button>
      </>
    ) : isFundraiser ? (
      <>
        <span className="nav-pill">Fundraiser</span>
        <button type="button" className="nav-link-button" onClick={homeLogout}>
          Log out
        </button>
      </>
    ) : (
      <>
        <a className="nav-link" href="#/">
          About
        </a>
        <a className="nav-link" href="mailto:support@fundme.local">
          Contact us
        </a>
      </>
    )

  return (
    <Layout headerLeft={headerLeft} headerRight={headerRight}>
      {loading ? (
        <div className="home-loading">
          <div className="home-loading-inner" aria-busy="true" aria-label="Loading">
            <div className="home-loading-dot" />
            <div className="home-loading-dot" />
            <div className="home-loading-dot" />
          </div>
        </div>
      ) : isAdmin ? (
        <AdminDashboard me={me} onLogout={homeLogout} />
      ) : isFundraiser ? (
        <div className="home-loading">
          <div className="home-loading-inner" aria-busy="true" aria-label="Opening">
            <div className="home-loading-dot" />
            <div className="home-loading-dot" />
            <div className="home-loading-dot" />
          </div>
        </div>
      ) : (
        <HomePage />
      )}
    </Layout>
  )
}
