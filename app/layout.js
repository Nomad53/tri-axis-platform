// TRI AXIS v0.1.5
// FILE DESTINATION: app/layout.js

import './globals.css'
import Link from 'next/link'

const APP_VERSION = 'v0.1.5'
const APP_MILESTONE = 'Prospect Table Discovery'

export const metadata = {
  title: 'Tri Axis | Industrial Prospect Intelligence',
  description:
    'Industrial prospect discovery and sales intelligence for Tri Axis Supply Company.'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <aside className="sidebar">
            <div className="brand">
              <p className="brand-title">TRI AXIS</p>
              <p className="brand-subtitle">
                Supply Company
              </p>
            </div>

            <nav className="sidebar-nav">
              <Link href="/">Dashboard</Link>
              <Link href="/discover">Discover</Link>
            </nav>

            <div className="sidebar-footer">
              <strong>Tri Axis {APP_VERSION}</strong>
              <br />
              {APP_MILESTONE}
            </div>
          </aside>

          <div className="main-content">
            {children}
          </div>
        </div>
      </body>
    </html>
  )
}
