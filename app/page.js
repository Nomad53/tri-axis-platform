import Link from 'next/link'
import { getProspects } from '../lib/prospects'

export default function HomePage() {
  const prospects = getProspects()
  const qualified = prospects.filter(p => p.relevance === 'High').length
  const reviewed = prospects.filter(p => p.status !== 'Discovered').length
  const cities = new Set(prospects.map(p => p.city).filter(Boolean)).size

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">TRI AXIS</div>
        <div className="brandSub">Supply Company</div>
        <nav>
          <Link className="navItem active" href="/">Dashboard</Link>
          <Link className="navItem" href="/discover">Discover</Link>
        </nav>
        <div className="version">v0.1 · Industrial Prospect Intelligence</div>
      </aside>

      <section className="content">
        <div className="eyebrow">M1 · COMPANY DISCOVERY</div>
        <h1>Industrial Prospect Intelligence</h1>
        <p className="lead">Build a clean database of Pakistani companies with credible industrial buying potential.</p>

        <div className="stats">
          <Stat label="Companies Discovered" value={prospects.length} />
          <Stat label="High Relevance" value={qualified} />
          <Stat label="Reviewed" value={reviewed} />
          <Stat label="Cities Covered" value={cities} />
        </div>

        <div className="panel">
          <div>
            <div className="panelLabel">Current milestone</div>
            <h2>Find the right companies first.</h2>
            <p>v0.1 deliberately excludes contacts, email automation, RFQs and finance. Discovery quality comes first.</p>
          </div>
          <Link className="primaryBtn" href="/discover">Open Discover</Link>
        </div>

        <div className="sectionHeader">
          <h2>Recent prospects</h2>
          <span>{prospects.length} total</span>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr><th>Company</th><th>Industry</th><th>City</th><th>Relevance</th><th>Status</th></tr>
            </thead>
            <tbody>
              {prospects.slice(0, 8).map(p => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong><small>{p.website || 'Website unknown'}</small></td>
                  <td>{p.industry}</td><td>{p.city}</td>
                  <td><span className={`pill ${p.relevance.toLowerCase()}`}>{p.relevance}</span></td>
                  <td>{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

function Stat({label, value}) {
  return <div className="stat"><div className="statValue">{value}</div><div className="statLabel">{label}</div></div>
}
