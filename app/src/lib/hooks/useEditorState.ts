import { useCallback, useEffect } from 'react'
import { ContentUpdate, IframeMessage, ContentValue } from '@/lib/communication/message-types'
import { useIframeBridge } from '@/lib/communication/iframe-bridge'
import {
  // Store hooks
  useEditorDraftChanges,
  useHasUnsavedChanges,
  useCanUndo,
  useCanRedo,
  useIsSaving,
  useUndoDescription,
  useRedoDescription,
  useIsExecutingCommand,
  useIsLoadingDrafts,
  useLastSavedAt,
  useHasUnpublishedChanges,
  
  // Store actions
  initializeEditor,
  addContentChange,
  clearEditor,
  setSavingState,
  changeText,
  changeConfig,
  changeImage,
  changeToggle,
  loadDraftContent,
  markDraftsSaved,
  markDraftsPublished,
  type ActionHandlers,
  
  // Store instance for direct access
  editorStore
} from '@/lib/stores/editorStore'

interface UseEditorStateReturn {
  draftChanges: Map<string, ContentUpdate>
  hasUnsavedChanges: boolean
  canUndo: boolean
  canRedo: boolean
  undo: () => Promise<void>
  redo: () => Promise<void>
  saveDraft: () => Promise<void>
  addChange: (change: ContentUpdate) => void
  isSaving: boolean
  isExecutingCommand: boolean
  undoDescription: string | null
  redoDescription: string | null
  clearDrafts: () => void
  
  // New draft loading functionality
  isLoadingDrafts: boolean
  lastSavedAt: number | null
  loadDrafts: () => Promise<void>
  hasUnpublishedChanges: boolean
  markPublished: () => void
  
  // New atomic action functions
  changeText: (elementId: string, newValue: string) => Promise<void>
  changeConfig: (configKey: string, newValue: ContentValue) => Promise<void>
  changeImage: (elementId: string, newImageUrl: string) => Promise<void>
  changeToggle: (elementId: string, newValue: boolean) => Promise<void>
}

export function useEditorState(organizationSlug: string): UseEditorStateReturn {
  const { on, off, bridge } = useIframeBridge()
  
  // Use store hooks
  const draftChanges = useEditorDraftChanges()
  const hasUnsavedChanges = useHasUnsavedChanges()
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()
  const isSaving = useIsSaving()
  const isExecutingCommand = useIsExecutingCommand()
  const undoDescription = useUndoDescription()
  const redoDescription = useRedoDescription()
  const isLoadingDrafts = useIsLoadingDrafts()
  const lastSavedAt = useLastSavedAt()
  const hasUnpublishedChanges = useHasUnpublishedChanges()

  // Action handlers for iframe communication
  const handleTextChange = useCallback(async (elementId: string, newValue: string) => {
    // Update iframe content
    if (bridge) {
      bridge.sendToIframe({
        type: 'UPDATE_CONTENT',
        payload: {
          elementId,
          content: newValue
        }
      })
    }
  }, [bridge])

  const handleConfigChange = useCallback(async (configKey: string, newValue: ContentValue) => {
    // Handle config changes (could trigger API calls or iframe updates)
    console.log('Config change:', configKey, newValue)
    // Implementation depends on specific config type
  }, [])

  const handleImageChange = useCallback(async (elementId: string, newImageUrl: string) => {
    console.log('🎯 ACTION HANDLER: handleImageChange called')
    console.log('🎯 ACTION HANDLER: Element ID:', elementId)
    console.log('🎯 ACTION HANDLER: New image URL:', newImageUrl)
    console.log('🎯 ACTION HANDLER: Bridge available:', !!bridge)
    
    // Update iframe image
    if (bridge) {
      console.log('🎯 ACTION HANDLER: Sending UPDATE_CONTENT to iframe')
      bridge.sendToIframe({
        type: 'UPDATE_CONTENT',
        payload: {
          elementId,
          content: newImageUrl
        }
      })
      console.log('✅ ACTION HANDLER: Message sent to iframe successfully')
    } else {
      console.log('❌ ACTION HANDLER: No bridge available - cannot update iframe')
    }
  }, [bridge])

  const handleToggleChange = useCallback(async (elementId: string, newValue: boolean) => {
    // Handle toggle changes (could trigger API calls or UI updates)
    console.log('Toggle change:', elementId, newValue)
  }, [])

  // Load drafts function
  const loadDrafts = useCallback(async () => {
    try {
      const draftData = await loadDraftContent(organizationSlug)
      
      // If we successfully loaded drafts and have iframe bridge, update iframe with draft content
      if (draftData && bridge) {
        // Send existing draft values to iframe  
        for (const [, blocks] of Object.entries(draftData.content)) {
          for (const [blockKey, blockData] of Object.entries(blocks)) {
            if (blockData.hasUnpublishedChanges || blockData.status === 'draft') {
              bridge.sendToIframe({
                type: 'UPDATE_CONTENT',
                payload: {
                  elementId: blockKey,
                  content: blockData.value
                }
              })
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading drafts:', error)
    }
  }, [organizationSlug, bridge])

  // Initialize editor and set action handlers when organization changes
  useEffect(() => {
    const actionHandlers: ActionHandlers = {
      onTextChange: handleTextChange,
      onConfigChange: handleConfigChange,
      onImageChange: handleImageChange,
      onToggleChange: handleToggleChange
    }
    
    initializeEditor(organizationSlug, actionHandlers)
    
    // Load existing drafts after initialization
    loadDrafts()
  }, [organizationSlug, handleTextChange, handleConfigChange, handleImageChange, handleToggleChange, loadDrafts])

  // Listen to content changes from iframe
  useEffect(() => {
    const handleContentChanged = (message: IframeMessage) => {
      console.log('CONTENT_CHANGED received:', message)
      
      // Skip processing if we're currently executing an undo/redo command
      if (isExecutingCommand) {
        console.log('Ignoring CONTENT_CHANGED during undo/redo operation')
        return
      }
      
      if (message.payload?.elementId && message.payload?.newContent !== undefined) {
        console.log('Processing content change:', message.payload)
        
        const { elementId, type = 'text', oldContent, newContent } = message.payload
        
        // Get the proper old value:
        // 1. If oldContent is provided in the message, use it
        // 2. Otherwise, use the current newValue from existing draft changes
        // 3. If no draft changes exist, this is the first edit so oldContent should be the original
        const currentDraftChange = draftChanges.get(elementId)
        let actualOldValue: unknown
        
        if (oldContent !== undefined) {
          actualOldValue = oldContent
        } else if (currentDraftChange) {
          // This is a continuation of editing - use the current draft value as the old value
          actualOldValue = currentDraftChange.newValue
        } else {
          // This shouldn't happen if iframe sends proper oldContent, but fallback to empty
          actualOldValue = ''
          console.warn('No oldContent provided and no existing draft for', elementId)
        }
        
        console.log('Content change values:', { elementId, oldContent, actualOldValue, newContent })
        
        // Skip if no actual change occurred
        if (actualOldValue === newContent) {
          console.log('Skipping duplicate content change - old and new values are the same')
          return
        }
        
        // Use atomic actions instead of direct addContentChange to maintain proper flow
        switch (type) {
          case 'text':
            // Don't await - this would create a circular dependency since handleTextChange updates iframe
            // Instead, directly add to store without executing the action (change already happened in iframe)
            addContentChange({
              elementId,
              type: 'text',
              oldValue: actualOldValue as ContentValue,
              newValue: newContent as ContentValue,
              timestamp: Date.now()
            })
            break
            
          case 'config':
          case 'toggle':
            addContentChange({
              elementId,
              type,
              oldValue: actualOldValue as ContentValue,
              newValue: newContent as ContentValue,
              timestamp: Date.now()
            })
            break
            
          case 'image':
            addContentChange({
              elementId,
              type: 'image',
              oldValue: actualOldValue as ContentValue,
              newValue: newContent as ContentValue,
              timestamp: Date.now()
            })
            break
            
          default:
            console.warn('Unknown content change type:', type)
        }
        
        console.log('Added change to draft:', { elementId, type, oldContent, newContent })
      }
    }

    on('CONTENT_CHANGED', handleContentChanged)
    return () => off('CONTENT_CHANGED')
  }, [on, off, isExecutingCommand, draftChanges])

  const undo = useCallback(async () => {
    const state = editorStore.state
    
    if (state.history.past.length === 0 || state.isExecutingCommand) {
      console.log('Cannot undo: no history or command executing')
      return
    }
    
    console.log('Starting undo operation')
    editorStore.setState(prev => ({ ...prev, isExecutingCommand: true }))
    
    try {
      const previousChanges = state.history.past[state.history.past.length - 1]
      const newPast = state.history.past.slice(0, -1)
      const newFuture = [state.history.present, ...state.history.future]
      
      // Send undo operations directly to iframe (in reverse order)
      for (let i = state.history.present.length - 1; i >= 0; i--) {
        const change = state.history.present[i]
        console.log('Undoing change:', change)
        
        if (bridge) {
          bridge.sendToIframe({
            type: 'UPDATE_CONTENT',
            payload: {
              elementId: change.elementId,
              content: change.oldValue
            }
          })
        }
      }
      
      // Update draft changes to reflect undo
      const newDraftChanges = new Map(state.draftChanges)
      state.history.present.forEach(change => {
        if (newDraftChanges.has(change.elementId)) {
          const existingChange = newDraftChanges.get(change.elementId)!
          // Revert to old value
          newDraftChanges.set(change.elementId, {
            ...existingChange,
            newValue: change.oldValue,
            timestamp: Date.now()
          })
        }
      })
      
      // Update store state
      editorStore.setState(prev => ({
        ...prev,
        draftChanges: newDraftChanges,
        history: {
          past: newPast,
          present: previousChanges,
          future: newFuture
        },
        isExecutingCommand: false
      }))
      
      console.log('Undo completed successfully')
    } catch (error) {
      console.error('Error during undo:', error)
      editorStore.setState(prev => ({ ...prev, isExecutingCommand: false }))
    }
  }, [bridge])

  const redo = useCallback(async () => {
    const state = editorStore.state
    
    if (state.history.future.length === 0 || state.isExecutingCommand) {
      console.log('Cannot redo: no future history or command executing')
      return
    }
    
    console.log('Starting redo operation')
    editorStore.setState(prev => ({ ...prev, isExecutingCommand: true }))
    
    try {
      const nextChanges = state.history.future[0]
      const newPast = [...state.history.past, state.history.present]
      const newFuture = state.history.future.slice(1)
      
      // Send redo operations directly to iframe (in forward order)
      for (const change of nextChanges) {
        console.log('Redoing change:', change)
        
        if (bridge) {
          bridge.sendToIframe({
            type: 'UPDATE_CONTENT',
            payload: {
              elementId: change.elementId,
              content: change.newValue
            }
          })
        }
      }
      
      // Update draft changes to reflect redo
      const newDraftChanges = new Map(state.draftChanges)
      nextChanges.forEach(change => {
        const existingChange = newDraftChanges.get(change.elementId)
        if (existingChange) {
          newDraftChanges.set(change.elementId, {
            ...existingChange,
            newValue: change.newValue,
            timestamp: Date.now()
          })
        } else {
          // Create new change if it doesn't exist
          newDraftChanges.set(change.elementId, {
            elementId: change.elementId,
            type: change.type,
            oldValue: change.oldValue,
            newValue: change.newValue,
            timestamp: Date.now()
          })
        }
      })
      
      // Update store state
      editorStore.setState(prev => ({
        ...prev,
        draftChanges: newDraftChanges,
        history: {
          past: newPast,
          present: nextChanges,
          future: newFuture
        },
        isExecutingCommand: false
      }))
      
      console.log('Redo completed successfully')
    } catch (error) {
      console.error('Error during redo:', error)
      editorStore.setState(prev => ({ ...prev, isExecutingCommand: false }))
    }
  }, [bridge])

  const saveDraft = useCallback(async () => {
    if (!hasUnsavedChanges) return

    setSavingState(true)
    
    try {
      const changesArray = Array.from(draftChanges.values())
      
      // Separate content updates from config updates
      const contentChanges = changesArray.filter(change => change.type !== 'config')
      const configChanges = changesArray.filter(change => change.type === 'config')
      
      // Build content updates array
      const updates = contentChanges.map(change => {
        const baseUpdate = {
          page: 'home', // TODO: determine page from context
          blockKey: change.elementId,
          content: String(change.newValue), // Ensure content is always a string
          type: change.type // Include the content type for proper handling
        };

        // For image changes, include metadata from the ContentUpdate
        if (change.type === 'image') {
          return {
            ...baseUpdate,
            imageId: change.imageId,
            optimizedImagePath: change.optimizedImagePath,
            imageSrcset: change.imageSrcset,
            imageAltText: change.imageAltText
          };
        }

        return baseUpdate;
      })
      
      // Build config object from config changes
      const config: Record<string, unknown> = {};
      configChanges.forEach(change => {
        config[change.elementId] = change.newValue;
      });

      // Prepare request body
      const requestBody: Record<string, unknown> = { organizationSlug };
      if (updates.length > 0) {
        requestBody.updates = updates;
      }
      if (Object.keys(config).length > 0) {
        requestBody.config = config;
      }

      console.log('🚀 Sending draft save request:', {
        organizationSlug,
        contentUpdates: updates.length,
        configUpdates: Object.keys(config).length,
        config
      });

      const response = await fetch('/api/content/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('❌ Draft save failed:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        })
        throw new Error(`Failed to save draft: ${response.status} ${response.statusText}${errorData.error ? ` - ${errorData.error}` : ''}`)
      }

      // Mark drafts as saved - this will clear the "unsaved changes" badge
      markDraftsSaved()
      
      console.log('Draft saved successfully at', new Date().toISOString())
      
    } catch (error) {
      console.error('Error saving draft:', error)
      throw error
    } finally {
      setSavingState(false)
    }
  }, [hasUnsavedChanges, draftChanges, organizationSlug])

  const clearDrafts = useCallback(() => {
    clearEditor()
  }, [])

  const markPublished = useCallback(() => {
    markDraftsPublished()
  }, [])

  // Direct change functions (legacy support)
  const addChange = useCallback((change: ContentUpdate) => {
    addContentChange(change)
  }, [])

  return {
    draftChanges,
    hasUnsavedChanges,
    canUndo,
    canRedo,
    undo,
    redo,
    saveDraft,
    addChange,
    isSaving,
    isExecutingCommand,
    undoDescription,
    redoDescription,
    clearDrafts,
    
    // New draft loading functionality
    isLoadingDrafts,
    lastSavedAt,
    loadDrafts,
    hasUnpublishedChanges,
    markPublished,
    
    // New atomic action functions - wrapped to provide oldValue from current state
    changeText: useCallback(async (elementId: string, newValue: string) => {
      const currentChange = draftChanges.get(elementId)
      const oldValue = currentChange ? currentChange.newValue : ''
      await changeText(elementId, newValue, oldValue as string)
    }, [draftChanges]),
    
    changeConfig: useCallback(async (configKey: string, newValue: ContentValue) => {
      const currentChange = draftChanges.get(configKey)
      const oldValue = currentChange ? currentChange.newValue : ''
      await changeConfig(configKey, newValue, oldValue)
    }, [draftChanges]),
    
    changeImage: useCallback(async (elementId: string, newImageUrl: string) => {
      const currentChange = draftChanges.get(elementId)
      const oldValue = currentChange ? currentChange.newValue : ''
      await changeImage(elementId, newImageUrl, oldValue as string)
    }, [draftChanges]),
    
    changeToggle: useCallback(async (elementId: string, newValue: boolean) => {
      const currentChange = draftChanges.get(elementId)
      const oldValue = currentChange ? currentChange.newValue : false
      await changeToggle(elementId, newValue, oldValue as boolean)
    }, [draftChanges])
  }
}