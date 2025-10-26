'use client'

import { useState, useEffect, useCallback } from 'react'
import { Group, Button, ActionIcon, Title, Badge, Loader, SegmentedControl, VisuallyHidden } from '@mantine/core'
import { Undo, Redo, Eye, EyeOff, Monitor, Smartphone } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { IframeContainer } from './IframeContainer'
import { EditorOverlay } from './EditorOverlay'
import { RightPanel } from './RightPanel'
import { useEditorState } from '@/lib/hooks/useEditorState'
import { useIframeBridge } from '@/lib/communication/iframe-bridge'

interface Site {
  id: string
  name: string
  slug: string
}

interface EditorInterfaceProps {
  site: Site
}

export function EditorInterface({ site }: EditorInterfaceProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [previewMode, setPreviewMode] = useState(false)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [viewportMode, setViewportMode] = useState<'desktop' | 'mobile'>('desktop')
  
  // Asset picker state
  const [showAssetPicker, setShowAssetPicker] = useState(false)
  const [selectedImageElement, setSelectedImageElement] = useState<string | null>(null)
  
  const {
    draftChanges,
    hasUnsavedChanges,
    canUndo,
    canRedo,
    undo,
    redo,
    saveDraft,
    isSaving,
    isExecutingCommand,
    addChange,
    undoDescription,
    redoDescription,
    clearDrafts,
    isLoadingDrafts,
    hasUnpublishedChanges,
    markPublished
  } = useEditorState(site.id)

  // Debug logging (can be removed after testing)
  console.log('EditorInterface state:', {
    draftChangesSize: draftChanges.size,
    hasUnsavedChanges,
    canUndo,
    canRedo,
    isSaving,
    isExecutingCommand,
    undoDescription,
    redoDescription
  })

  const { bridge } = useIframeBridge()

  const handleExit = useCallback(() => {
    router.push('/')
  }, [router])

  const togglePreviewMode = useCallback(() => {
    setPreviewMode(prev => !prev)
  }, [])

  const handleViewportChange = useCallback((value: string) => {
    setViewportMode(value as 'desktop' | 'mobile')
  }, [])

  const handleCancelReplacement = useCallback(() => {
    setShowAssetPicker(false)
    setSelectedImageElement(null)
  }, [])

  // Asset picker handlers
  const handleImageSelect = useCallback(async (image: { id: string, fileName: string, publicUrl: string }) => {
    if (!selectedImageElement) return;

    console.log('🎯 Image selected:', image);
    
    try {
      // Sync image to client site and get optimized path
      const syncResponse = await fetch('/api/images/sync-to-client', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageId: image.id,
          siteId: site.id,
          blockKey: selectedImageElement,
          altText: `Image for ${selectedImageElement}`
        })
      });

      if (!syncResponse.ok) {
        throw new Error('Failed to sync image to client site');
      }

      const syncResult = await syncResponse.json();
      console.log('✅ Image sync result:', syncResult);

      // Use optimized path for iframe preview
      const previewPath = syncResult.optimizedPath;
      
      if (bridge) {
        console.log('🖼️ Updating iframe with optimized path:', previewPath);
        bridge.updateContent(selectedImageElement, previewPath);
      }

      // Add change to editor state with image metadata
      addChange({
        elementId: selectedImageElement,
        type: 'image',
        oldValue: '', // Will be filled by the store
        newValue: previewPath,
        timestamp: Date.now(),
        // Store image metadata for draft saving
        imageId: image.id,
        optimizedImagePath: previewPath,
        imageAltText: `Image for ${selectedImageElement}`
      });

      console.log('✅ Image selection completed successfully');
    } catch (error) {
      console.error('❌ Image selection failed:', error);
      
      // Fallback: use the original URL for preview (not ideal but functional)
      if (bridge) {
        bridge.updateContent(selectedImageElement, image.publicUrl);
      }
      
      addChange({
        elementId: selectedImageElement,
        type: 'image',
        oldValue: '',
        newValue: image.publicUrl,
        timestamp: Date.now()
      });
    }
  }, [bridge, selectedImageElement, addChange, site.id])

  const handleUploadNew = useCallback(() => {
    // TODO: Implement upload modal
    console.log('Upload new image functionality not yet implemented')
  }, [])


  // Auto-save with debouncing when changes occur
  useEffect(() => {
    if (!hasUnsavedChanges || isSaving) return

    const saveTimeout = setTimeout(async () => {
      try {
        await saveDraft()
      } catch (error) {
        console.error('Failed to auto-save draft:', error)
      }
    }, 1000) // 1 second debounce

    return () => clearTimeout(saveTimeout)
  }, [hasUnsavedChanges, isSaving, saveDraft])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'z':
            e.preventDefault()
            if (e.shiftKey) {
              redo()
            } else {
              undo()
            }
            break
          case 'y':
            e.preventDefault()
            redo()
            break
          case 'Escape':
            handleExit()
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, handleExit])

  const clientSiteUrl = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3001'
    : `http://localhost:3001` // Generated site preview URL

  // Set allowed origins for iframe bridge
  useEffect(() => {
    if (bridge) {
      const allowedOrigins = [
        'http://localhost:3001',
        `http://localhost:3001`
      ]
      bridge.setAllowedOrigins(allowedOrigins)
    }
  }, [bridge, site.id])

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      background: '#f8f9fa',
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Editor Header */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e9ecef',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: '60px'
      }}>
        <Group gap="md">
          <Title order={4} style={{ margin: 0 }}>
            Editing: {site.name}
          </Title>
        </Group>

        <Group gap="sm">
          {/* Undo/Redo */}
          <Group gap="xs">
            <ActionIcon
              variant="subtle"
              disabled={!canUndo || isExecutingCommand}
              onClick={undo}
              title={canUndo ? `Undo: ${undoDescription}` : "Nothing to undo"}
            >
              <Undo size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              disabled={!canRedo || isExecutingCommand}
              onClick={redo}
              title={canRedo ? `Redo: ${redoDescription}` : "Nothing to redo"}
            >
              <Redo size={16} />
            </ActionIcon>
          </Group>

          {/* Responsive Toggle - only show when preview mode is active */}
          {previewMode && (
            <SegmentedControl
              value={viewportMode}
              onChange={handleViewportChange}
              size="md"
              data={[
                {
                  value: 'desktop',
                  label: (
                    <>
                      <Monitor size={16} style={{ color: 'var(--mantine-color-blue-6)', display: 'block' }} />
                      <VisuallyHidden>Desktop</VisuallyHidden>
                    </>
                  ),
                },
                {
                  value: 'mobile',
                  label: (
                    <>
                      <Smartphone size={16} style={{ color: 'var(--mantine-color-blue-6)', display: 'block' }} />
                      <VisuallyHidden>Mobile</VisuallyHidden>
                    </>
                  )
                }
              ]}
            />
          )}

          {/* Preview Toggle */}
          <Button
            variant="subtle"
            size="sm"
            leftSection={previewMode ? <EyeOff size={16} /> : <Eye size={16} />}
            onClick={togglePreviewMode}
          >
            Preview
          </Button>
        </Group>
      </div>

      {/* Editor Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Client Site Iframe */}
        <div style={{
          flex: 1,
          position: 'relative',
          background: previewMode && viewportMode === 'mobile' ? '#f8f9fa' : 'white',
          display: previewMode && viewportMode === 'mobile' ? 'flex' : 'block',
          justifyContent: previewMode && viewportMode === 'mobile' ? 'center' : 'initial',
          alignItems: previewMode && viewportMode === 'mobile' ? 'stretch' : 'initial'
        }}>
          <div style={{
            width: previewMode && viewportMode === 'mobile' ? '375px' : '100%',
            height: '100%',
            position: 'relative',
            transition: previewMode ? 'width 0.3s ease-in-out' : 'none'
          }}>
            <IframeContainer
              src={clientSiteUrl}
              onLoad={() => {
                setIframeLoaded(true)
                setIsLoading(false)
              }}
              site={site}
            />
          </div>
          
          {/* Editor Overlay - show when not in preview mode and iframe is loaded */}
          {!previewMode && iframeLoaded && (
            <EditorOverlay
              onContentChange={addChange}
              siteId={site.id}
              onImageEditStart={(elementId) => {
                setSelectedImageElement(elementId)
                setShowAssetPicker(true)
              }}
            />
          )}
        </div>

        {/* Right Panel - hide in preview mode */}
        {!previewMode && (
          <RightPanel
            site={site}
            draftChanges={draftChanges}
            hasUnsavedChanges={hasUnsavedChanges}
            hasUnpublishedChanges={hasUnpublishedChanges}
            onClearDrafts={clearDrafts}
            onMarkPublished={markPublished}
            saveDraft={saveDraft}
            onPublishComplete={() => {
              // Refresh iframe to show published changes
              window.location.reload()
            }}
            showAssetPicker={showAssetPicker}
            onSelectImage={handleImageSelect}
            onUploadNew={handleUploadNew}
            selectedImageId={selectedImageElement}
            onCancelReplacement={handleCancelReplacement}
          />
        )}
      </div>

      {/* Loading Overlay */}
      {(isLoading || isLoadingDrafts) && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(248, 249, 250, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '1rem',
          zIndex: 1000
        }}>
          <Loader size="lg" />
          <p style={{ color: '#666', margin: 0 }}>
            {isLoadingDrafts 
              ? `Loading draft content for ${site.name}...`
              : `Loading ${site.name} website...`
            }
          </p>
        </div>
      )}
    </div>
  )
}