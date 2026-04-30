import './HomePage.css'

export function HomePage() {
  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-actions">
          <a className="home-secondary" href="#/login">
            Log in
          </a>
        </div>
      </section>

      <section className="home-cards">
        <div className="home-card">
          <h2>Fundraising Activities</h2>
          <div className="home-blank-space" aria-hidden="true" />
        </div>
      </section>
    </div>
  )
}

