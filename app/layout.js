import './globals.css'

export const metadata = {
  title: 'CEX Balance Dashboard',
  description: 'Multi-exchange balance tracker',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
