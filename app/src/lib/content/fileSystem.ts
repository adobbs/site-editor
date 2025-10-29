// File-based content system for Visual Website Editor
// Replaces Supabase API calls with local file operations

export interface SiteContent {
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
}

export interface DraftContent {
  site: SiteContent
  lastModified: string
}

/**
 * Load site content from file system
 * In Visual Website Editor, sites are stored in /generated-sites/[siteId]/
 */
export async function loadSiteContent(siteId: string): Promise<SiteContent | null> {
  try {
    const response = await fetch(`/api/sites/${siteId}/content`)
    if (!response.ok) return null
    return await response.json()
  } catch (error) {
    console.error('Error loading site content:', error)
    return null
  }
}

/**
 * Save site content to file system
 */
export async function saveSiteContent(siteId: string, content: SiteContent): Promise<boolean> {
  try {
    const response = await fetch(`/api/sites/${siteId}/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content)
    })
    return response.ok
  } catch (error) {
    console.error('Error saving site content:', error)
    return false
  }
}

/**
 * Load draft changes from localStorage
 * Used for temporary storage before saving to file
 */
export function loadDraftFromLocalStorage(siteId: string): Map<string, any> | null {
  try {
    const stored = localStorage.getItem(`vwe-draft-${siteId}`)
    if (!stored) return null

    const parsed = JSON.parse(stored)
    return new Map(Object.entries(parsed))
  } catch (error) {
    console.error('Error loading draft from localStorage:', error)
    return null
  }
}

/**
 * Save draft changes to localStorage
 */
export function saveDraftToLocalStorage(siteId: string, changes: Map<string, any>): void {
  try {
    const obj = Object.fromEntries(changes)
    localStorage.setItem(`vwe-draft-${siteId}`, JSON.stringify(obj))
  } catch (error) {
    console.error('Error saving draft to localStorage:', error)
  }
}

/**
 * Clear draft from localStorage after publishing
 */
export function clearDraftFromLocalStorage(siteId: string): void {
  try {
    localStorage.removeItem(`vwe-draft-${siteId}`)
  } catch (error) {
    console.error('Error clearing draft from localStorage:', error)
  }
}
