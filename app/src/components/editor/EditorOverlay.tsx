'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Button, Text, Card, Group } from '@mantine/core'
import { Edit2, Check, X, Image as ImageIcon, Upload } from 'lucide-react'
import { ContentUpdate, IframeMessage } from '@/lib/communication/message-types'
import { useIframeBridge } from '@/lib/communication/iframe-bridge'
import { changeImage } from '@/lib/stores/editorStore'

interface ElementInfo {
  id: string
  tagName: string
  textContent: string
  attributes: Record<string, string>
  bounds: DOMRect
}

interface EditorOverlayProps {
  onContentChange?: (change: ContentUpdate) => void
  siteId?: string
  onImageEditStart?: (elementId: string) => void
}

export function EditorOverlay({ onContentChange, siteId, onImageEditStart }: EditorOverlayProps) {
  const { on, off, enterEditMode, exitEditMode, updateContent } = useIframeBridge()
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null)
  const [editingElement, setEditingElement] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)
  

  const startEditing = useCallback((element: ElementInfo) => {
    setEditingElement(element.id)
    setEditValue(element.textContent)
    enterEditMode(element.id)
  }, [enterEditMode])


  const startImageEditing = useCallback((element: ElementInfo) => {
    console.log('🚀 EDITOR: startImageEditing called for element:', element.id)
    console.log('🚀 EDITOR: Site ID:', siteId)

    if (!siteId) {
      console.log('❌ EDITOR: No site ID - cannot start image editing')
      return
    }

    setSelectedElement(element)
    console.log('🚀 EDITOR: Opening asset picker in right panel...')
    onImageEditStart?.(element.id)
    console.log('✅ EDITOR: Asset picker triggered successfully')
  }, [siteId, onImageEditStart])

  // Handle element selection from iframe
  const handleElementSelected = useCallback((message: IframeMessage) => {
    console.log('🎯 EDITOR: handleElementSelected called with:', message)
    if (message.payload?.element) {
      const element = message.payload.element as ElementInfo
      console.log('🎯 EDITOR: Element selected:', element.id, 'type:', element.attributes['data-editor-type'])
      console.log('🎯 EDITOR: Element attributes:', element.attributes)
      setSelectedElement(element)
    } else {
      console.log('❌ EDITOR: No element in payload')
    }
  }, [])

  // Handle element clicks from iframe
  const handleElementClicked = useCallback((message: IframeMessage) => {
    console.log('👆 EDITOR: handleElementClicked called with:', message)
    if (editingElement) {
      console.log('👆 EDITOR: Ignoring click - currently editing:', editingElement)
      return
    }
    if (message.payload?.element) {
      const element = message.payload.element as ElementInfo
      console.log('👆 EDITOR: Element clicked:', element.id, 'type:', element.attributes['data-editor-type'])
      setSelectedElement(element)
      // Auto-start editing based on element type
      if (element.attributes['data-editor-type'] === 'text') {
        console.log('📝 EDITOR: Starting text editing for:', element.id)
        startEditing(element)
      } else if (element.attributes['data-editor-type'] === 'image') {
        console.log('🖼️ EDITOR: Starting image editing for:', element.id)
        startImageEditing(element)
      } else {
        console.log('❓ EDITOR: Unknown element type:', element.attributes['data-editor-type'])
      }
    } else {
      console.log('❌ EDITOR: No element in clicked message payload')
    }
  }, [startEditing, startImageEditing, editingElement])

  // Handle content changes from iframe
  const handleContentChanged = useCallback((message: IframeMessage) => {
    if (message.payload?.elementId && message.payload?.newContent !== undefined) {
      // Only exit edit mode if this content change is for the element we're currently editing
      // AND the content actually changed (not just a click event)
      if (editingElement && 
          message.payload.elementId === editingElement && 
          message.payload.newContent !== selectedElement?.textContent) {
        setEditingElement(null)
        setEditValue('')
      }
    }
  }, [editingElement, selectedElement?.textContent])

  // Handle element deselection from iframe
  const handleElementDeselected = useCallback((message: IframeMessage) => {
    console.log('Element deselected from iframe')
    // Only clear editing state if we're not currently editing, or if it's the element we're editing
    if (!editingElement || (message.payload?.elementId && message.payload.elementId === editingElement)) {
      setSelectedElement(null)
      setEditingElement(null)
      setEditValue('')
    }
  }, [editingElement])

  useEffect(() => {
    on('ELEMENT_SELECTED', handleElementSelected)
    on('ELEMENT_CLICKED', handleElementClicked)
    on('CONTENT_CHANGED', handleContentChanged)
    on('ELEMENT_DESELECTED', handleElementDeselected)

    return () => {
      off('ELEMENT_SELECTED')
      off('ELEMENT_CLICKED')
      off('CONTENT_CHANGED')
      off('ELEMENT_DESELECTED')
    }
  }, [on, off, handleElementSelected, handleElementClicked, handleContentChanged, handleElementDeselected])

  const saveEdit = useCallback(() => {
    if (editingElement && selectedElement && editValue.trim()) {
      console.log('Saving edit:', editingElement, 'new value:', editValue.trim())
      
      // Send the content update via PostMessage to update the iframe
      updateContent(editingElement, editValue.trim())
      
      // Create the content change for the editor state
      const editorType = selectedElement.attributes['data-editor-type']
      const change: ContentUpdate = {
        elementId: editingElement,
        type: (editorType === 'text' || editorType === 'image' || editorType === 'toggle' || editorType === 'config') 
              ? editorType 
              : 'text',
        oldValue: selectedElement.textContent || '',
        newValue: editValue.trim(),
        timestamp: Date.now()
      }
      
      // Trigger the content change callback to update editor state
      onContentChange?.(change)
      
      // Exit edit mode and deselect element
      setEditingElement(null)
      setEditValue('')
      setSelectedElement(null)
      exitEditMode()
    }
  }, [editingElement, selectedElement, editValue, updateContent, onContentChange, exitEditMode])

  const cancelEdit = useCallback(() => {
    setEditingElement(null)
    setEditValue('')
    exitEditMode()
  }, [exitEditMode])

  const getElementPosition = (bounds: DOMRect) => {
    if (!overlayRef.current) return { top: 0, left: 0, width: 0, height: 0 }
    
    // Find the iframe element to get its position within the editor
    const iframe = document.querySelector('iframe[src*="localhost:3001"]') as HTMLIFrameElement
    if (!iframe) return { top: 0, left: 0, width: 0, height: 0 }
    
    const iframeRect = iframe.getBoundingClientRect()
    const overlayRect = overlayRef.current.getBoundingClientRect()
    
    // Calculate the iframe's position relative to our overlay
    const iframeOffsetX = iframeRect.left - overlayRect.left
    const iframeOffsetY = iframeRect.top - overlayRect.top
    
    // Position the element relative to the iframe's position within our overlay
    return {
      top: bounds.top + iframeOffsetY,
      left: bounds.left + iframeOffsetX,
      width: bounds.width,
      height: bounds.height
    }
  }

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 10
      }}
    >
      {/* Visual indicator for selected element */}
      {selectedElement && !editingElement && (
        <div style={{
          position: 'absolute',
          ...getElementPosition(selectedElement.bounds),
          border: '2px solid #007bff',
          borderRadius: '4px',
          background: 'rgba(0, 123, 255, 0.05)',
          pointerEvents: 'none',
        }}>
          {/* Edit button tooltip */}
          <div 
            style={{
              position: 'absolute',
              top: '-32px',
              left: '0',
              pointerEvents: 'all'
            }}
          >
            <Button
              size="xs"
              leftSection={selectedElement.attributes['data-editor-type'] === 'image' ? <ImageIcon size={12} /> : <Edit2 size={12} />}
              onClick={() => {
                if (selectedElement.attributes['data-editor-type'] === 'image') {
                  startImageEditing(selectedElement)
                } else {
                  startEditing(selectedElement)
                }
              }}
              style={{
                fontSize: '11px',
                height: '24px',
                padding: '0 8px'
              }}
            >
              {selectedElement.attributes['data-editor-type'] === 'image' ? 'Replace Image' : `Edit ${selectedElement.attributes['data-editor-type']}`}
            </Button>
          </div>
        </div>
      )}

      {/* Simple edit popover */}
      {editingElement && selectedElement && (
        <div 
          style={{
            position: 'absolute',
            top: getElementPosition(selectedElement.bounds).top - 60,
            left: getElementPosition(selectedElement.bounds).left,
            pointerEvents: 'all',
            zIndex: 1000,
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: '250px'
          }}
        >
          <Group gap="xs">
            <input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              style={{
                border: '1px solid #ddd',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '14px',
                flex: 1,
                minWidth: '150px'
              }}
              placeholder="Enter text..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  saveEdit()
                } else if (e.key === 'Escape') {
                  cancelEdit()
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <Button size="xs" onClick={saveEdit} disabled={!editValue.trim()}>
              <Check size={12} />
            </Button>
            <Button size="xs" variant="subtle" onClick={cancelEdit}>
              <X size={12} />
            </Button>
          </Group>
        </div>
      )}

      {/* Visual indicator for editing element */}
      {editingElement && selectedElement && (
        <div style={{
          position: 'absolute',
          ...getElementPosition(selectedElement.bounds),
          border: '2px solid #28a745',
          borderRadius: '4px',
          background: 'rgba(40, 167, 69, 0.05)',
          pointerEvents: 'none',
        }} />
      )}

      {editingElement && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 999 }} />
      )}

      {/* Simple floating hint for discoverability */}
      {!selectedElement && !editingElement && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none'
          }}
        >
          <Card p="sm" shadow="sm" style={{ 
            background: 'var(--mantine-color-blue-6)', 
            borderRadius: '8px'
          }}>
            <Text size="sm" c="white" ta="center">
              Click on text, images, or buttons to edit
            </Text>
          </Card>
        </div>
      )}


    </div>
  )
}