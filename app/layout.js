import './globals.css'

export const metadata = {
  title: 'Liquid Fund Dashboard',
  description: 'Liquid Fund Internal Dashboard',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
