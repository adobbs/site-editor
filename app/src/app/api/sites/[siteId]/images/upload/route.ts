import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

// Base directory for generated sites
const SITES_DIR = path.join(process.cwd(), '..', 'generated-sites')

/**
 * POST /api/sites/[siteId]/images/upload
 * Upload images to local file system
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params

  try {
    // Parse multipart form data
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // Validate files
    const maxFileSize = 10 * 1024 * 1024 // 10MB
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']

    for (const file of files) {
      if (file.size > maxFileSize) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds 10MB limit` },
          { status: 400 }
        )
      }

      if (!allowedMimeTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `File "${file.name}" has unsupported type. Only JPEG, PNG, WebP, GIF, and SVG are allowed.` },
          { status: 400 }
        )
      }
    }

    // Ensure images directory exists
    const sitePath = path.join(SITES_DIR, siteId)
    const imagesDir = path.join(sitePath, 'public', 'images')

    try {
      await fs.access(sitePath)
    } catch {
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      )
    }

    await fs.mkdir(imagesDir, { recursive: true })

    // Upload files
    const uploadedFiles = []

    for (const file of files) {
      // Generate safe filename
      const timestamp = Date.now()
      const randomString = Math.random().toString(36).substring(2, 8)
      const fileExtension = file.name.split('.').pop()
      const baseName = file.name.substring(0, file.name.lastIndexOf('.'))
      const safeName = baseName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase()
      const uniqueFileName = `${safeName}-${timestamp}-${randomString}.${fileExtension}`

      // Convert file to buffer and save
      const buffer = Buffer.from(await file.arrayBuffer())
      const filePath = path.join(imagesDir, uniqueFileName)

      await fs.writeFile(filePath, buffer)

      uploadedFiles.push({
        id: uniqueFileName, // Use filename as ID for simplicity
        fileName: uniqueFileName,
        originalName: file.name,
        publicUrl: `/images/${uniqueFileName}`, // Relative URL for the site
        fileSize: file.size,
        mimeType: file.type,
        uploadedAt: new Date().toISOString()
      })
    }

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded ${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''}`,
      uploadedFiles
    })
  } catch (error) {
    console.error('Image upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload images', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
