import { redirect } from 'next/navigation'

// This page handles the `/edit` URL functionality
// It redirects users to the visual editor in the Visual Website Editor app
export default function EditPage() {
  // Get the site ID from environment variable
  const siteId = process.env.SITE_ID || 'business-template'

  // Construct the editor URL (points to Visual Website Editor app)
  const vweAppUrl = process.env.VWE_APP_URL || 'http://localhost:3000'
  const editorUrl = `${vweAppUrl}/editor/${siteId}`

  // Redirect to the visual editor
  redirect(editorUrl)
}
