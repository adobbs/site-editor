import { EditorInterface } from '@/components/editor/EditorInterface'

interface EditorPageProps {
  params: Promise<{
    siteId: string
  }>
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { siteId } = await params

  // In Visual Website Editor, we don't have auth - just load the editor for the site
  // The site object is simplified (no user roles, no auth checks)
  const site = {
    id: siteId,
    name: siteId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), // "my-site" -> "My Site"
    slug: siteId
  }

  return <EditorInterface site={site} />
}
