import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

// Base directory for generated sites
const SITES_DIR = path.join(process.cwd(), '..', 'generated-sites')

/**
 * GET /api/sites/list
 * List all generated sites
 */
export async function GET() {
  try {
    // Ensure sites directory exists
    try {
      await fs.access(SITES_DIR)
    } catch {
      // Directory doesn't exist yet, return empty array
      return NextResponse.json({ sites: [] })
    }

    // Read all site directories
    const entries = await fs.readdir(SITES_DIR, { withFileTypes: true })
    const siteDirs = entries.filter(entry => entry.isDirectory())

    // Load metadata for each site
    const sites = await Promise.all(
      siteDirs.map(async (dir) => {
        try {
          const contentPath = path.join(SITES_DIR, dir.name, 'content', 'site.json')
          const contentStr = await fs.readFile(contentPath, 'utf-8')
          const content = JSON.parse(contentStr)

          return {
            id: content.site.id,
            name: content.site.name,
            slug: content.site.slug,
            lastModified: content.lastModified || null,
            brandColor: content.config.brand_color
          }
        } catch {
          // Skip invalid sites
          return null
        }
      })
    )

    // Filter out null entries
    const validSites = sites.filter(site => site !== null)

    return NextResponse.json({ sites: validSites })
  } catch (error) {
    console.error('Error listing sites:', error)
    return NextResponse.json(
      { error: 'Failed to list sites' },
      { status: 500 }
    )
  }
}
