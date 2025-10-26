import { Store } from '@tanstack/store'
import { useStore } from '@tanstack/react-store'
import type { ContentUpdate, ContentValue } from '@/lib/communication/message-types'

// Editor change types for better type safety
export interface EditorChange {
  id: string
  elementId: string
  type: 'text' | 'image' | 'toggle' | 'config'
  oldValue: ContentValue
  newValue: ContentValue
  timestamp: number
  description: string
  scopeName?: string // For conflict resolution
}

// History state using past/present/future pattern
export interface EditorHistoryState {
  past: EditorChange[][]
  present: EditorChange[]
  future: EditorChange[][]
}

// Main editor state
export interface EditorState {
  // Site context (replaces organization for file-based system)
  siteId: string | null
  
  // Draft changes (current unsaved edits)
  draftChanges: Map<string, ContentUpdate>
  
  // Original content values (for proper undo)
  originalContent: Map<string, unknown>
  
  // Published content values (for comparing changes from published state)
  publishedContent: Map<string, unknown>
  
  // Undo/redo history
  history: EditorHistoryState
  
  // Editor UI state
  isSaving: boolean
  isExecutingCommand: boolean
  selectedElement: string | null
  editingMode: 'preview' | 'edit'
  
  // Communication state
  iframeReady: boolean
  
  // Draft state tracking
  lastSavedAt: number | null
  isLoadingDrafts: boolean
  hasUnsavedEdits: boolean // Tracks if there are edits since last save
  hasUnpublishedChanges: boolean // Tracks if there are draft changes that haven't been published
}

// Initial state
const initialState: EditorState = {
  siteId: null,
  draftChanges: new Map(),
  originalContent: new Map(),
  publishedContent: new Map(),
  history: {
    past: [],
    present: [],
    future: []
  },
  isSaving: false,
  isExecutingCommand: false,
  selectedElement: null,
  editingMode: 'edit',
  iframeReady: false,
  lastSavedAt: null,
  isLoadingDrafts: false,
  hasUnsavedEdits: false,
  hasUnpublishedChanges: false
}

// Create the store
export const editorStore = new Store<EditorState>(initialState)

// Utility function to generate change ID
const generateChangeId = () => `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

// Utility function to create change description
const createChangeDescription = (change: EditorChange): string => {
  switch (change.type) {
    case 'text':
      const truncatedOld = typeof change.oldValue === 'string' 
        ? change.oldValue.slice(0, 30) + (change.oldValue.length > 30 ? '...' : '')
        : String(change.oldValue)
      const truncatedNew = typeof change.newValue === 'string' 
        ? change.newValue.slice(0, 30) + (change.newValue.length > 30 ? '...' : '')
        : String(change.newValue)
      return `Change "${change.elementId}" from "${truncatedOld}" to "${truncatedNew}"`
    case 'config':
    case 'toggle':
      return `Change ${change.elementId} from ${JSON.stringify(change.oldValue)} to ${JSON.stringify(change.newValue)}`
    case 'image':
      return `Change "${change.elementId}" image from "${change.oldValue}" to "${change.newValue}"`
    default:
      return `Change ${change.elementId}`
  }
}

/**
 * Utility function to check if draft changes represent actual changes from original content.
 * This is used to determine if there are unsaved changes, especially after undo operations
 * that might revert content back to its original state.
 */
export const hasActualChanges = (draftChanges: Map<string, ContentUpdate>, originalContent: Map<string, unknown>): boolean => {
  for (const [elementId, draftChange] of draftChanges) {
    const originalValue = originalContent.get(elementId)
    
    // If we don't have original content, consider it changed
    if (originalValue === undefined) return true
    
    // If the current draft value differs from original, we have changes
    if (draftChange.newValue !== originalValue) return true
  }
  
  return false
}

/**
 * Interface for draft content from API
 */
interface DraftContentBlock {
  value: string // Current value (for backward compatibility)
  publishedValue?: string | null // What's currently published
  draftValue?: string | null // What's in draft
  status: 'draft' | 'published' | 'empty'
  hasUnpublishedChanges: boolean
  publishedAt?: string | null
}

interface DraftContentResponse {
  organization: {
    slug: string
    name: string
  }
  config: {
    brand_color: string
    cta_button_enabled: boolean
  }
  content: {
    [pageSlug: string]: {
      [blockKey: string]: DraftContentBlock
    }
  }
  metadata: {
    lastUpdated: string | null
    totalBlocks: number
    draftBlocks: number
    publishedBlocks: number
    unpublishedChanges: number
    cacheKey: string
  }
}

// Atomic action handlers for different change types
export interface ActionHandlers {
  onTextChange?: (elementId: string, newValue: string) => Promise<void>
  onConfigChange?: (configKey: string, newValue: ContentValue) => Promise<void>
  onImageChange?: (elementId: string, newImageUrl: string) => Promise<void>
  onToggleChange?: (elementId: string, newValue: boolean) => Promise<void>
}

// Store action handlers globally for use in undo/redo
let globalActionHandlers: ActionHandlers = {}

// Action: Set action handlers for undo/redo operations
export const setActionHandlers = (handlers: ActionHandlers) => {
  globalActionHandlers = { ...handlers }
}

// Action: Initialize editor for site
export const initializeEditor = (siteId: string, handlers?: ActionHandlers) => {
  if (handlers) {
    setActionHandlers(handlers)
  }

  editorStore.setState(state => ({
    ...state,
    siteId,
    draftChanges: new Map(),
    originalContent: new Map(),
    publishedContent: new Map(),
    history: {
      past: [],
      present: [],
      future: []
    },
    selectedElement: null,
    iframeReady: false,
    lastSavedAt: null,
    isLoadingDrafts: false,
    hasUnsavedEdits: false,
    hasUnpublishedChanges: false
  }))
}

// Action: Load draft content from file system
export const loadDraftContent = async (siteId: string): Promise<DraftContentResponse | null> => {
  editorStore.setState(state => ({ ...state, isLoadingDrafts: true }))

  try {
    // Load site content from file system
    const response = await fetch(`/api/sites/${siteId}/content`)

    if (!response.ok) {
      throw new Error(`Failed to load site content: ${response.status}`)
    }

    const siteData = await response.json()

    // Convert file-based format to DraftContentResponse format
    const draftData: DraftContentResponse = {
      organization: {
        slug: siteData.site.slug,
        name: siteData.site.name
      },
      config: siteData.config,
      content: {},
      metadata: {
        lastUpdated: siteData.lastModified || null,
        totalBlocks: 0,
        draftBlocks: 0,
        publishedBlocks: 0,
        unpublishedChanges: 0,
        cacheKey: siteId
      }
    }

    // Convert pages to content format
    for (const [pageSlug, blocks] of Object.entries(siteData.pages)) {
      draftData.content[pageSlug] = {}
      for (const [blockKey, value] of Object.entries(blocks as Record<string, any>)) {
        draftData.content[pageSlug][blockKey] = {
          value: typeof value === 'string' ? value : JSON.stringify(value),
          publishedValue: typeof value === 'string' ? value : JSON.stringify(value),
          draftValue: null,
          status: 'published' as const,
          hasUnpublishedChanges: false,
          publishedAt: siteData.lastModified || new Date().toISOString()
        }
      }
    }
    
    // Convert API response to store format
    const newDraftChanges = new Map<string, ContentUpdate>()
    const newOriginalContent = new Map<string, unknown>()
    const newPublishedContent = new Map<string, unknown>()
    
    // Process all pages and blocks
    for (const [, blocks] of Object.entries(draftData.content)) {
      for (const [blockKey, blockData] of Object.entries(blocks)) {
        // Only load blocks that have draft changes or unpublished content
        if (blockData.hasUnpublishedChanges || blockData.status === 'draft') {
          // Determine the proper oldValue and newValue based on published/draft content
          let oldValue: unknown = ''
          let newValue: unknown = ''
          
          if (blockData.publishedValue && blockData.draftValue) {
            // Case 1: Has both published and draft content (editing existing content)
            oldValue = blockData.publishedValue
            newValue = blockData.draftValue
          } else if (blockData.draftValue && !blockData.publishedValue) {
            // Case 2: New content (never published) 
            oldValue = '' // No published content
            newValue = blockData.draftValue
          } else {
            // Fallback: use current value logic
            oldValue = blockData.status === 'published' ? blockData.value : ''
            newValue = blockData.value
          }

          const contentUpdate: ContentUpdate = {
            elementId: blockKey,
            type: 'text', // Default to text, could be enhanced later
            oldValue: oldValue as ContentValue,
            newValue: newValue as ContentValue,
            timestamp: blockData.publishedAt ? new Date(blockData.publishedAt).getTime() : Date.now()
          }
          
          newDraftChanges.set(blockKey, contentUpdate)
          
          // Set original content to the published value (or empty for new content)
          // This is what we compare against for "unsaved changes" 
          newOriginalContent.set(blockKey, blockData.publishedValue || '')
          
          // Store published content separately for proper change comparison
          newPublishedContent.set(blockKey, blockData.publishedValue || '')
        }
      }
    }
    
    editorStore.setState(state => ({
      ...state,
      draftChanges: newDraftChanges,
      originalContent: newOriginalContent,
      publishedContent: newPublishedContent,
      isLoadingDrafts: false,
      lastSavedAt: draftData.metadata.lastUpdated ? new Date(draftData.metadata.lastUpdated).getTime() : null,
      hasUnsavedEdits: false, // Loaded drafts are considered "saved"
      hasUnpublishedChanges: newDraftChanges.size > 0 // Has unpublished changes if there are draft changes
    }))
    
    return draftData
    
  } catch (error) {
    console.error('Error loading draft content:', error)
    editorStore.setState(state => ({ ...state, isLoadingDrafts: false }))
    return null
  }
}

// Action: Mark drafts as saved after successful API call
export const markDraftsSaved = () => {
  editorStore.setState(state => ({
    ...state,
    lastSavedAt: Date.now(),
    hasUnsavedEdits: false
    // Keep hasUnpublishedChanges true - saving drafts doesn't publish them
  }))
}

// Action: Mark drafts as published (clears unpublished changes)
export const markDraftsPublished = () => {
  editorStore.setState(state => {
    const newPublishedContent = new Map(state.publishedContent)
    
    // Update published content with the current draft values
    for (const [elementId, change] of state.draftChanges) {
      newPublishedContent.set(elementId, change.newValue)
    }
    
    return {
      ...state,
      publishedContent: newPublishedContent,
      hasUnpublishedChanges: false
    }
  })
}

// Atomic action: Text change
export const changeText = async (elementId: string, newValue: string, oldValue: string) => {
  const update: ContentUpdate = {
    elementId,
    type: 'text',
    oldValue,
    newValue,
    timestamp: Date.now()
  }
  
  // Execute the change immediately
  if (globalActionHandlers.onTextChange) {
    await globalActionHandlers.onTextChange(elementId, newValue)
  }
  
  // Add to store
  addContentChange(update)
}

// Atomic action: Config change
export const changeConfig = async (configKey: string, newValue: ContentValue, oldValue: ContentValue) => {
  const update: ContentUpdate = {
    elementId: configKey,
    type: 'config',
    oldValue,
    newValue,
    timestamp: Date.now()
  }
  
  // Execute the change immediately
  if (globalActionHandlers.onConfigChange) {
    await globalActionHandlers.onConfigChange(configKey, newValue)
  }
  
  // Add to store
  addContentChange(update)
}

// Atomic action: Image change
export const changeImage = async (elementId: string, newImageUrl: string, oldImageUrl: string) => {
  const update: ContentUpdate = {
    elementId,
    type: 'image',
    oldValue: oldImageUrl,
    newValue: newImageUrl,
    timestamp: Date.now()
  }
  
  // Execute the change immediately
  if (globalActionHandlers.onImageChange) {
    await globalActionHandlers.onImageChange(elementId, newImageUrl)
  }
  
  // Add to store
  addContentChange(update)
}

// Atomic action: Toggle change
export const changeToggle = async (elementId: string, newValue: boolean, oldValue: boolean) => {
  const update: ContentUpdate = {
    elementId,
    type: 'toggle',
    oldValue,
    newValue,
    timestamp: Date.now()
  }
  
  // Execute the change immediately
  if (globalActionHandlers.onToggleChange) {
    await globalActionHandlers.onToggleChange(elementId, newValue)
  }
  
  // Add to store
  addContentChange(update)
}

// Action: Add a content change
export const addContentChange = (update: ContentUpdate) => {
  console.log('addContentChange called with:', update)
  
  const change: EditorChange = {
    id: generateChangeId(),
    elementId: update.elementId,
    type: update.type,
    oldValue: update.oldValue,
    newValue: update.newValue,
    timestamp: update.timestamp,
    description: createChangeDescription({
      elementId: update.elementId,
      type: update.type,
      oldValue: update.oldValue,
      newValue: update.newValue
    } as EditorChange),
    scopeName: update.elementId // Use elementId as scope for conflict resolution
  }
  
  editorStore.setState(state => {
    const newDraftChanges = new Map(state.draftChanges)
    const newOriginalContent = new Map(state.originalContent)
    const newPublishedContent = new Map(state.publishedContent)
    
    // Store original content value if this is the first change for this element
    if (!state.originalContent.has(update.elementId)) {
      newOriginalContent.set(update.elementId, update.oldValue)
      console.log('Storing original content for', update.elementId, ':', update.oldValue)
    }
    
    // Store published content if this is the first change for this element
    // Use existing published value if available, otherwise use the oldValue
    if (!state.publishedContent.has(update.elementId)) {
      newPublishedContent.set(update.elementId, update.oldValue)
    }
    
    // Update the ContentUpdate to use the published value as oldValue for display purposes
    const updatedChange: ContentUpdate = {
      ...update,
      oldValue: (state.publishedContent.get(update.elementId) as ContentValue) || update.oldValue
    }
    
    newDraftChanges.set(update.elementId, updatedChange)
    
    // Add to history
    const newHistory = {
      past: [...state.history.past, state.history.present],
      present: [change],
      future: [] // Clear future when new action is performed
    }
    
    console.log('Store state update:', {
      oldDraftChangesSize: state.draftChanges.size,
      newDraftChangesSize: newDraftChanges.size,
      oldHistoryPastLength: state.history.past.length,
      newHistoryPastLength: newHistory.past.length,
      change
    })
    
    return {
      ...state,
      draftChanges: newDraftChanges,
      originalContent: newOriginalContent,
      publishedContent: newPublishedContent,
      history: newHistory,
      hasUnsavedEdits: true, // Mark as having unsaved edits when changes are made
      hasUnpublishedChanges: true // Also mark as having unpublished changes
    }
  })
}

// Action: Execute batch changes (for composite operations)
export const addBatchChanges = (updates: ContentUpdate[]) => {
  const changes: EditorChange[] = updates.map(update => ({
    id: generateChangeId(),
    elementId: update.elementId,
    type: update.type,
    oldValue: update.oldValue,
    newValue: update.newValue,
    timestamp: update.timestamp,
    description: createChangeDescription({
      elementId: update.elementId,
      type: update.type
    } as EditorChange),
    scopeName: update.elementId
  }))
  
  editorStore.setState(state => {
    const newDraftChanges = new Map(state.draftChanges)
    updates.forEach(update => {
      newDraftChanges.set(update.elementId, update)
    })
    
    // Add batch to history
    const newHistory = {
      past: [...state.history.past, state.history.present],
      present: changes,
      future: []
    }
    
    return {
      ...state,
      draftChanges: newDraftChanges,
      history: newHistory
    }
  })
}

// NOTE: Undo/redo logic has been moved to useEditorState hook for direct iframe communication

// Action: Clear all drafts and history
export const clearEditor = () => {
  editorStore.setState(state => ({
    ...state,
    draftChanges: new Map(),
    originalContent: new Map(),
    publishedContent: new Map(),
    history: {
      past: [],
      present: [],
      future: []
    },
    hasUnsavedEdits: false,
    hasUnpublishedChanges: false
  }))
}

// Action: Set saving state
export const setSavingState = (isSaving: boolean) => {
  editorStore.setState(state => ({
    ...state,
    isSaving
  }))
}

// Action: Set iframe ready state
export const setIframeReady = (ready: boolean) => {
  editorStore.setState(state => ({
    ...state,
    iframeReady: ready
  }))
}

// Action: Set selected element
export const setSelectedElement = (elementId: string | null) => {
  editorStore.setState(state => ({
    ...state,
    selectedElement: elementId
  }))
}

// Action: Set editing mode
export const setEditingMode = (mode: 'preview' | 'edit') => {
  editorStore.setState(state => ({
    ...state,
    editingMode: mode
  }))
}

// Selectors and hooks
export const useEditorStore = () => useStore(editorStore)

export const useEditorDraftChanges = () => 
  useStore(editorStore, state => state.draftChanges)

export const useEditorHistory = () => 
  useStore(editorStore, state => state.history)

export const useCanUndo = () => 
  useStore(editorStore, state => state.history.past.length > 0 && !state.isExecutingCommand)

export const useCanRedo = () => 
  useStore(editorStore, state => state.history.future.length > 0 && !state.isExecutingCommand)

/**
 * Hook to determine if there are unsaved changes.
 * Now uses the hasUnsavedEdits flag for more accurate tracking.
 */
export const useHasUnsavedChanges = () => 
  useStore(editorStore, state => {
    // Use the explicit hasUnsavedEdits flag which is managed by save operations
    return state.hasUnsavedEdits
  })

export const useIsSaving = () => 
  useStore(editorStore, state => state.isSaving)

export const useIsExecutingCommand = () => 
  useStore(editorStore, state => state.isExecutingCommand)

export const useUndoDescription = () => 
  useStore(editorStore, state => {
    if (state.history.past.length === 0) return null
    const lastChanges = state.history.past[state.history.past.length - 1]
    if (lastChanges.length === 1) {
      return lastChanges[0].description
    }
    return `${lastChanges.length} changes`
  })

export const useRedoDescription = () => 
  useStore(editorStore, state => {
    if (state.history.future.length === 0) return null
    const nextChanges = state.history.future[0]
    if (nextChanges.length === 1) {
      return nextChanges[0].description
    }
    return `${nextChanges.length} changes`
  })

export const useSiteId = () =>
  useStore(editorStore, state => state.siteId)

export const useSelectedElement = () => 
  useStore(editorStore, state => state.selectedElement)

export const useEditingMode = () => 
  useStore(editorStore, state => state.editingMode)

export const useIframeReady = () => 
  useStore(editorStore, state => state.iframeReady)

export const useOriginalContent = () => 
  useStore(editorStore, state => state.originalContent)

export const useIsLoadingDrafts = () => 
  useStore(editorStore, state => state.isLoadingDrafts)

export const useLastSavedAt = () => 
  useStore(editorStore, state => state.lastSavedAt)

export const useHasUnpublishedChanges = () => 
  useStore(editorStore, state => state.hasUnpublishedChanges)

export const usePublishedContent = () => 
  useStore(editorStore, state => state.publishedContent)