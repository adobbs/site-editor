import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, mkdirSync, existsSync, renameSync, readdirSync } from 'fs';
import { join } from 'path';

interface DistributeRequest {
  path: string; // Target path like "/images/optimized/hero-496w.webp"
  buffer: number[]; // Array of bytes
  contentType: string;
  organizationSlug: string;
  isFirstVariant?: boolean; // Flag to indicate if this is the first variant of a new image set
  blockKey?: string; // Block key for the image being replaced (e.g., "man-reading-relaxing")
}

export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.REVALIDATE_SECRET;
    
    if (!authHeader || !expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    if (token !== expectedSecret) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body: DistributeRequest = await request.json();
    const { path, buffer, contentType, organizationSlug, isFirstVariant, blockKey } = body;

    // Validate input
    if (!path || !buffer || !organizationSlug) {
      return NextResponse.json({ 
        error: 'Missing required fields: path, buffer, organizationSlug' 
      }, { status: 400 });
    }

    // Verify organization matches this client site
    const expectedOrgSlug = process.env.ORGANIZATION_SLUG;
    if (organizationSlug !== expectedOrgSlug) {
      return NextResponse.json({ 
        error: 'Organization mismatch' 
      }, { status: 403 });
    }

    try {
      // Ensure the target directory exists
      const fullPath = join(process.cwd(), 'public', path);
      const directory = join(fullPath, '..');
      
      if (!existsSync(directory)) {
        mkdirSync(directory, { recursive: true });
        console.log(`📁 Created directory: ${directory}`);
      }

      console.log(`🔍 Distribution request details:`, {
        isFirstVariant,
        blockKey,
        path,
        organizationSlug
      });

      // Only run backup logic for the first variant of a new image set
      if (isFirstVariant) {
        console.log('🔄 FIRST VARIANT DETECTED - Running backup logic');
        
        // Move existing images to backup folder before installing new ones
        const backupDir = join(process.cwd(), 'public', 'images', 'optimized-backup');
        if (!existsSync(backupDir)) {
          mkdirSync(backupDir, { recursive: true });
          console.log(`📁 Created backup directory: ${backupDir}`);
        }

        if (blockKey) {
          console.log(`🔍 BACKUP: Looking for existing images for block key: "${blockKey}"`);
          
          try {
            // Find and move any existing images for this block key to backup
            const optimizedDir = join(process.cwd(), 'public', 'images', 'optimized');
            if (existsSync(optimizedDir)) {
              // Look for any images that start with the block key pattern
              // e.g., "man-reading-relaxing" should match "man-reading-relaxing-*.webp"
              const existingFiles = readdirSync(optimizedDir).filter(file => {
                // Match files that start with blockKey followed by dash or extension
                const pattern = new RegExp(`^${blockKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[-.].*\\.(webp|jpeg|jpg)$`, 'i');
                return pattern.test(file);
              });
              
              console.log(`🔍 BACKUP: Found ${existingFiles.length} existing files to backup for block "${blockKey}":`, existingFiles);
              
              if (existingFiles.length === 0) {
                console.log(`ℹ️ BACKUP: No existing files found to backup for pattern: ^${blockKey}[-.].*\\.(webp|jpeg|jpg)$`);
              }
              
              for (const existingFile of existingFiles) {
                const oldPath = join(optimizedDir, existingFile);
                const newBackupPath = join(backupDir, existingFile);
                
                console.log(`🚚 BACKUP: Moving ${existingFile} from optimized to backup...`);
                
                try {
                  renameSync(oldPath, newBackupPath);
                  console.log(`✅ BACKUP SUCCESS: Moved ${existingFile} to backup`);
                } catch (moveError) {
                  console.error(`❌ BACKUP FAILED: Could not move ${existingFile} to backup:`, moveError);
                }
              }
            }
          } catch (backupError) {
            console.warn('⚠️ Error during backup process:', backupError);
            // Continue with installation even if backup fails
          }
        } else {
          console.log('⚠️ BACKUP SKIPPED: No block key provided');
        }
      } else {
        console.log('📷 SUBSEQUENT VARIANT: Skipping backup logic (isFirstVariant=false)');
      }

      // Convert array of bytes back to Buffer and save the new file
      const fileBuffer = Buffer.from(new Uint8Array(buffer));
      
      writeFileSync(fullPath, fileBuffer);
      
      console.log(`💾 Saved optimized image: ${path} (${fileBuffer.length} bytes, ${contentType})`);

      return NextResponse.json({
        success: true,
        message: `Successfully saved optimized image`,
        path,
        savedBytes: fileBuffer.length,
        contentType,
        organizationSlug,
        publicPath: path // Path accessible via web server
      });

    } catch (error) {
      console.error('File save error:', error);
      return NextResponse.json({ 
        error: 'Failed to save optimized image',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Image distribution endpoint error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}