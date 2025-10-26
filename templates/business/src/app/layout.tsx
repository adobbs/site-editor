import "./globals.css";
import { EditorBridgeProvider } from '@/lib/EditorBridgeProvider'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <EditorBridgeProvider />
      </body>
    </html>
  );
}
