import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

// Base directory for generated sites
const SITES_DIR = path.join(process.cwd(), '..', 'generated-sites')

/**
 * GET /api/sites/[siteId]/images/list
 * List all images from local file system
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params

  try {
    const sitePath = path.join(SITES_DIR, siteId)
    const imagesDir = path.join(sitePath, 'public', 'images')

    // Check if site exists
    try {
      await fs.access(sitePath)
    } catch {
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      )
    }

    // Ensure images directory exists
    try {
      await fs.access(imagesDir)
    } catch {
      // Images directory doesn't exist yet, return empty array
      return NextResponse.json({
        success: true,
        images: [],
        totalCount: 0,
        totalSize: 0
      })
    }

    // Read all files in images directory
    const files = await fs.readdir(imagesDir)

    // Filter for image files and get stats
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']
    const images = []

    for (const file of files) {
      const ext = path.extname(file).toLowerCase()
      if (imageExtensions.includes(ext)) {
        const filePath = path.join(imagesDir, file)
        const stats = await fs.stat(filePath)

        // Get MIME type from extension
        const mimeTypes: { [key: string]: string } = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.webp': 'image/webp',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml'
        }

        images.push({
          id: file, // Use filename as ID
          fileName: file,
          originalName: file,
          publicUrl: `/images/${file}`, // Relative URL for the site
          fileSize: stats.size,
          mimeType: mimeTypes[ext] || 'application/octet-stream',
          uploadedAt: stats.mtime.toISOString(),
          uploadedBy: 'local'
        })
      }
    }

    // Sort by upload date (newest first)
    images.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())

    return NextResponse.json({
      success: true,
      images,
      totalCount: images.length,
      totalSize: images.reduce((sum, img) => sum + img.fileSize, 0)
    })
  } catch (error) {
    console.error('List images error:', error)
    return NextResponse.json(
      { error: 'Failed to list images', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
