import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { secret, paths, organizationSlug, reason } = await request.json();
    
    // Verify the revalidation secret
    if (secret !== process.env.REVALIDATE_SECRET) {
      return NextResponse.json({ 
        message: 'Invalid secret' 
      }, { status: 401 });
    }

    // Validate paths
    if (!paths || !Array.isArray(paths)) {
      return NextResponse.json({ 
        message: 'Invalid paths array' 
      }, { status: 400 });
    }

    const revalidatedPaths = [];
    const errors = [];

    // Revalidate each path
    for (const path of paths) {
      try {
        await revalidatePath(path);
        revalidatedPaths.push(path);
      } catch (error) {
        errors.push({ path, error: (error as Error).message });
      }
    }

    const response = {
      revalidated: true,
      paths: revalidatedPaths,
      timestamp: Date.now(),
      organizationSlug,
      reason,
      ...(errors.length > 0 && { errors })
    };

    console.log('ISR Revalidation completed:', response);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Revalidation error:', error);
    return NextResponse.json({ 
      message: 'Error revalidating',
      error: (error as Error).message 
    }, { status: 500 });
  }
}