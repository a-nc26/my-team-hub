import './globals.css'

export const metadata = {
  title: 'My Team Hub',
  description: 'Team management dashboard',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
