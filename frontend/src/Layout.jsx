import './Layout.css'

function Header({ left, right }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <nav className="site-nav site-nav-left" aria-label="Primary">
          {left}
        </nav>
        <a className="site-brand" href="#/" aria-label="SunshineFundraising home">
          SunshineFundraising
        </a>
        <nav className="site-nav site-nav-right" aria-label="Account">
          {right}
        </nav>
      </div>
    </header>
  )
}

export function Layout({ headerLeft, headerRight, children }) {
  return (
    <div className="site-shell">
      <Header left={headerLeft} right={headerRight} />
      <main className="site-main">{children}</main>
    </div>
  )
}

