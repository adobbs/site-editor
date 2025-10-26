import { redirect } from 'next/navigation'

// This page handles the `/dib` URL functionality
// It redirects users to the visual editor in the main dib app
export default function DibEditorPage() {
  // Get the site ID from environment variable
  const siteId = process.env.SITE_ID || 'business-template'

  // Construct the editor URL (points to main dib app)
  const dibAppUrl = process.env.DIB_APP_URL || 'http://localhost:3000'
  const editorUrl = `${dibAppUrl}/editor/${siteId}`

  // Redirect to the visual editor
  redirect(editorUrl)
}
