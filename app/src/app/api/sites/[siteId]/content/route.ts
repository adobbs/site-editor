import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

// Base directory for generated sites
const SITES_DIR = path.join(process.cwd(), '..', 'generated-sites')

interface SiteContent {
  site: {
    id: string
    name: string
    slug: string
  }
  config: {
    brand_color: string
    cta_button_enabled: boolean
  }
  pages: {
    [pageSlug: string]: {
      [blockKey: string]: string | {
        src: string
        srcset?: string
        alt?: string
        type: 'image'
      }
    }
  }
  lastModified?: string
}

/**
 * GET /api/sites/[siteId]/content
 * Load site content from file system
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params

  try {
    const sitePath = path.join(SITES_DIR, siteId)
    const contentPath = path.join(sitePath, 'content', 'site.json')

    // Check if site exists
    try {
      await fs.access(sitePath)
    } catch {
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      )
    }

    // Read content file
    const contentStr = await fs.readFile(contentPath, 'utf-8')
    const content: SiteContent = JSON.parse(contentStr)

    return NextResponse.json(content)
  } catch (error) {
    console.error('Error loading site content:', error)
    return NextResponse.json(
      { error: 'Failed to load site content' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/sites/[siteId]/content
 * Save site content to file system
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params

  try {
    const content: SiteContent = await request.json()

    // Add lastModified timestamp
    content.lastModified = new Date().toISOString()

    const sitePath = path.join(SITES_DIR, siteId)
    const contentPath = path.join(sitePath, 'content', 'site.json')

    // Ensure content directory exists
    await fs.mkdir(path.join(sitePath, 'content'), { recursive: true })

    // Write content file
    await fs.writeFile(
      contentPath,
      JSON.stringify(content, null, 2),
      'utf-8'
    )

    return NextResponse.json({ success: true, lastModified: content.lastModified })
  } catch (error) {
    console.error('Error saving site content:', error)
    return NextResponse.json(
      { error: 'Failed to save site content' },
      { status: 500 }
    )
  }
}
