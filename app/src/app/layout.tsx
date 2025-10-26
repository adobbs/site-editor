import type { Metadata } from 'next'
import { MantineProvider, createTheme } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/dropzone/styles.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'dib - design it better',
  description: 'Open source visual website builder - Create with AI, edit visually, own your code',
}

const theme = createTheme({
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  primaryColor: 'blue',
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <MantineProvider theme={theme}>
          <ModalsProvider>
            <Notifications />
            {children}
          </ModalsProvider>
        </MantineProvider>
      </body>
    </html>
  )
}
