import './globals.css'

export const metadata = {
  title: 'Tri Axis | Industrial Prospect Intelligence',
  description: 'Industrial prospect discovery for Pakistan'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
