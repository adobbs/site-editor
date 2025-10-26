import { promises as fs } from 'fs';
import path from 'path';

export interface ImageBlock {
  src: string;      // Static path like "/images/optimized/hero-496w.webp"
  srcset?: string;  // Responsive srcset
  alt?: string;     // Alt text
  type: 'image';
}

interface SiteContent {
  site: {
    id: string;
    slug: string;
    name: string;
  };
  config: {
    brand_color: string;
    cta_button_enabled: boolean;
  };
  pages: {
    home: {
      headline: string;
      subhead: string;
      'cta-text': string;
      'hero-image'?: string | ImageBlock;
    };
  };
}

// Load content from local JSON file
async function loadLocalContent(): Promise<SiteContent | null> {
  try {
    const contentPath = path.join(process.cwd(), 'content', 'site.json');
    const fileContent = await fs.readFile(contentPath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.warn('Could not read local content file:', error);
    return null;
  }
}

// Fetch content - tries local file first, then dib API as fallback
export async function fetchContentFromCMS(): Promise<SiteContent> {
  const siteId = process.env.SITE_ID;
  const dibApiBase = process.env.DIB_API_BASE;

  try {
    // Try dib API if configured (for when editing with visual editor)
    if (dibApiBase && siteId) {
      const response = await fetch(`${dibApiBase}/api/sites/${siteId}/content`, {
        headers: {
          'Content-Type': 'application/json',
        },
        // Cache for ISR
        next: { revalidate: 3600 } // Revalidate at most once per hour
      });

      if (response.ok) {
        const data = await response.json();
        // Convert API format to template format
        return {
          site: data.site,
          config: data.config,
          pages: data.pages
        };
      }
    }
  } catch (error) {
    console.warn('dib API not available, trying local content');
  }

  // Try local content file
  const localContent = await loadLocalContent();
  if (localContent) {
    return localContent;
  }

  // Use hardcoded fallback as last resort
  return getFallbackContent();
}

// Fallback content - generic business template
function getFallbackContent(): SiteContent {
  return {
    site: {
      id: process.env.SITE_ID || 'business-template',
      slug: process.env.SITE_ID || 'business-template',
      name: process.env.NEXT_PUBLIC_SITE_NAME || 'Your Business Name'
    },
    config: {
      brand_color: '#2563EB',
      cta_button_enabled: true
    },
    pages: {
      home: {
        headline: 'Welcome to Your Business',
        subhead: 'Professional services tailored to your needs',
        'cta-text': 'Get Started',
        'hero-image': '/images/hero-image.png'
      }
    }
  };
}

// Utility function to get image properties from hero-image data
export function getImageProps(heroImage?: string | ImageBlock, fallbackSrc: string = "/images/hero-image.png", fallbackAlt: string = "Business hero image") {
  // Handle ImageBlock format
  if (heroImage && typeof heroImage === 'object' && heroImage.type === 'image') {
    return {
      src: heroImage.src,
      srcSet: heroImage.srcset,
      alt: heroImage.alt || fallbackAlt
    };
  }

  // Handle string format (legacy support)
  if (typeof heroImage === 'string') {
    return {
      src: heroImage,
      srcSet: undefined,
      alt: fallbackAlt
    };
  }

  // Fallback when no image provided
  return {
    src: fallbackSrc,
    srcSet: undefined,
    alt: fallbackAlt
  };
}

// Utility function to adjust color brightness
export function adjustBrightness(color: string, amount: number): string {
  const usePound = color[0] === '#';
  const col = usePound ? color.slice(1) : color;
  const num = parseInt(col, 16);
  let r = (num >> 16) + amount;
  let g = (num >> 8 & 0x00FF) + amount;
  let b = (num & 0x0000FF) + amount;
  r = r > 255 ? 255 : r < 0 ? 0 : r;
  g = g > 255 ? 255 : g < 0 ? 0 : g;
  b = b > 255 ? 255 : b < 0 ? 0 : b;
  return (usePound ? '#' : '') + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
}
