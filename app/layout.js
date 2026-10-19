// TRI AXIS v0.3.0
// COMPLETE REPLACEMENT FILE
// DESTINATION: app/layout.js

import './globals.css'
import Link from 'next/link'

const APP_VERSION = 'v0.3.0'
const APP_MILESTONE = '5-Field Prospect Database'

export const metadata = {
  title:
    'Tri Axis | Prospect Database',

  description:
    'Tri Axis Supply Company prospecting and outreach platform.'
}

export default function RootLayout({
  children
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <aside className="sidebar">
            <div className="brand">
              <p className="brand-title">
                TRI AXIS
              </p>

              <p className="brand-subtitle">
                Supply Company
              </p>
            </div>

            <nav className="sidebar-nav">
              <Link href="/">
                Dashboard
              </Link>

              <Link href="/discover">
                Companies
              </Link>
            </nav>

            <div className="sidebar-footer">
              <strong>
                Tri Axis {APP_VERSION}
              </strong>

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
