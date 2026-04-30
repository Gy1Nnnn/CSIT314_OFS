import { useEffect, useState } from 'react'
import { LoginPanel } from './LoginPanel.jsx'
import { HomeLayout } from './HomeLayout.jsx'
import { Layout } from './Layout.jsx'
import { ManageAccountsPage } from './ManageAccountsPage.jsx'
import { ManageProfilesPage } from './ManageProfilesPage.jsx'
import { ManageFundraisingActivitiesPage } from './ManageFundraisingActivitiesPage.jsx'

function parseHash() {
  const raw = window.location.hash || '#/'
  const withoutHash = raw.startsWith('#') ? raw.slice(1) : raw
  const pathPart = withoutHash.split('?')[0]
  const path = pathPart || '/'
  return { path }
}

function App() {
  const [route, setRoute] = useState(() => parseHash())

  useEffect(() => {
    function onHashChange() {
      setRoute(parseHash())
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  if (route.path === '/login') {
    return (
      <Layout
        headerLeft={
          <>
            <a className="nav-link" href="#/">
              Donate
            </a>
            <a className="nav-link" href="#/">
              Fundraise
            </a>
          </>
        }
        headerRight={
          <>
            <a className="nav-link" href="#/">
              About
            </a>
            <a className="nav-link" href="mailto:support@fundme.local">
              Contact us
            </a>
          </>
        }
      >
        <div className="login-page">
          <LoginPanel />
        </div>
      </Layout>
    )
  }

  if (route.path === '/admin/profiles') {
    return (
      <Layout
        headerLeft={
          <>
            <a className="nav-link" href="#/">
              Donate
            </a>
            <a className="nav-link" href="#/">
              Fundraise
            </a>
          </>
        }
        headerRight={
          <a className="nav-link" href="#/">
            ← Dashboard
          </a>
        }
      >
        <ManageProfilesPage />
      </Layout>
    )
  }

  if (route.path === '/admin/accounts') {
    return (
      <Layout
        headerLeft={
          <>
            <a className="nav-link" href="#/">
              Donate
            </a>
            <a className="nav-link" href="#/">
              Fundraise
            </a>
          </>
        }
        headerRight={
          <a className="nav-link" href="#/">
            ← Dashboard
          </a>
        }
      >
        <ManageAccountsPage />
      </Layout>
    )
  }

  if (route.path === '/fundraiser/activities') {
    return (
      <Layout
        headerLeft={
          <>
            <a className="nav-link" href="#/">
              Donate
            </a>
            <a className="nav-link" href="#/">
              Fundraise
            </a>
          </>
        }
        headerRight={null}
      >
        <ManageFundraisingActivitiesPage />
      </Layout>
    )
  }

  return <HomeLayout />
}

export default App
