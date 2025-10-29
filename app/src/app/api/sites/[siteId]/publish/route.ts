import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

// Base directory for generated sites
const SITES_DIR = path.join(process.cwd(), '..', 'generated-sites')

/**
 * POST /api/sites/[siteId]/publish
 * Publish draft changes - in Visual Website Editor this means writing content to the site's data files
 * and optionally triggering a rebuild
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params

  try {
    const body = await request.json()
    const { changes } = body // Map of element changes

    const sitePath = path.join(SITES_DIR, siteId)
    const contentPath = path.join(sitePath, 'content', 'site.json')

    // Read current content
    const contentStr = await fs.readFile(contentPath, 'utf-8')
    const content = JSON.parse(contentStr)

    // Apply changes to content
    for (const [elementId, change] of Object.entries(changes as Record<string, any>)) {
      // Parse elementId to get page and block key
      // Format: "home.headline" or just "headline" (assumes home page)
      const parts = elementId.split('.')
      const pageSlug = parts.length > 1 ? parts[0] : 'home'
      const blockKey = parts.length > 1 ? parts[1] : parts[0]

      // Handle config changes (brand_color, cta_button_enabled)
      if (change.type === 'config' || change.type === 'toggle') {
        content.config[blockKey] = change.newValue
      } else {
        // Handle content changes
        if (!content.pages[pageSlug]) {
          content.pages[pageSlug] = {}
        }
        content.pages[pageSlug][blockKey] = change.newValue
      }
    }

    // Update timestamp
    content.lastModified = new Date().toISOString()

    // Write updated content
    await fs.writeFile(
      contentPath,
      JSON.stringify(content, null, 2),
      'utf-8'
    )

    return NextResponse.json({
      success: true,
      publishedAt: content.lastModified,
      changesCount: Object.keys(changes).length
    })
  } catch (error) {
    console.error('Error publishing changes:', error)
    return NextResponse.json(
      { error: 'Failed to publish changes' },
      { status: 500 }
    )
  }
}
