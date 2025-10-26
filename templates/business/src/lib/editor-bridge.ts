// Client-side editor bridge for handling PostMessage communication with visual editor

interface EditorMessage {
  type: string
  messageId: string
  timestamp: number
  payload: any
}

class ClientEditorBridge {
  private isInEditorMode = false
  private editorOrigin: string | null = null
  private selectedElement: HTMLElement | null = null

  constructor() {
    this.setupMessageListener()
    this.setupClickHandlers()
    this.detectEditorMode()
  }

  private detectEditorMode() {
    // Check if we're inside an iframe (being edited)
    console.log('🔍 CLIENT: Detecting editor mode...')
    console.log('🔍 CLIENT: window.parent === window:', window.parent === window)
    console.log('🔍 CLIENT: window.location:', window.location.href)
    
    try {
      console.log('🔍 CLIENT: parent location:', window.parent.location.href)
    } catch (e) {
      console.log('🔍 CLIENT: Cannot access parent location (cross-origin)')
    }
    
    if (window.parent !== window) {
      console.log('✅ CLIENT: In iframe - enabling editor mode')
      this.isInEditorMode = true
      this.sendToEditor({
        type: 'IFRAME_READY',
        payload: { ready: true }
      })
    } else {
      console.log('❌ CLIENT: Not in iframe - staying in normal mode')
    }
  }

  private setupMessageListener() {
    window.addEventListener('message', (event) => {
      try {
        const message: EditorMessage = event.data

        // Store editor origin for security
        if (!this.editorOrigin && event.origin.includes('localhost:3000')) {
          this.editorOrigin = event.origin
        }

        // Only accept messages from editor origin
        if (this.editorOrigin && event.origin !== this.editorOrigin) {
          return
        }

        this.handleEditorMessage(message)
      } catch (error) {
        console.error('Error handling editor message:', error)
      }
    })
  }

  private handleEditorMessage(message: EditorMessage) {
    switch (message.type) {
      case 'EDITOR_READY':
        this.isInEditorMode = true
        this.highlightEditableElements()
        break
      case 'SELECT_ELEMENT':
        this.selectElement(message.payload.selector)
        break
      case 'UPDATE_CONTENT':
        this.updateElementContent(message.payload.elementId, message.payload.content)
        break
      case 'ENTER_EDIT_MODE':
        this.enterEditMode(message.payload.elementId)
        break
      case 'EXIT_EDIT_MODE':
        this.exitEditMode()
        break
    }
  }

  private setupClickHandlers() {
    console.log('🔧 CLIENT: Setting up click handlers')
    document.addEventListener('click', (event) => {
      console.log('👆 CLIENT: Click detected on:', event.target)
      console.log('👆 CLIENT: Editor mode:', this.isInEditorMode)
      
      if (!this.isInEditorMode) {
        console.log('❌ CLIENT: Not in editor mode, ignoring click')
        return
      }

      const target = event.target as HTMLElement
      const editableElement = target.closest('[data-editable="true"]')

      console.log('🎯 CLIENT: Looking for editable element...')
      console.log('🎯 CLIENT: Target:', target.tagName, target.getAttribute('data-editor-id'))
      console.log('🎯 CLIENT: Found editable:', editableElement?.tagName, editableElement?.getAttribute('data-editor-id'))

      if (editableElement) {
        console.log('✅ CLIENT: Editable element clicked, preventing default and selecting')
        event.preventDefault()
        event.stopPropagation()
        this.selectElement(editableElement as HTMLElement)
      } else {
        // Only deselect if clicking on background/empty areas
        // Don't deselect when clicking on any elements that might have functionality
        const isBodyOrBackground = target === document.body || 
                                  target.tagName === 'HTML' ||
                                  target.classList.contains('bg-') ||
                                  (!target.closest('button, a, input, select, textarea, [role="button"], [data-editable]'))
        
        if (isBodyOrBackground && target !== this.selectedElement) {
          console.log('🔄 CLIENT: Clicking on background area, deselecting')
          this.deselectElement()
        }
      }
    })
  }

  private highlightEditableElements() {
    const editableElements = document.querySelectorAll('[data-editable="true"]')
    
    editableElements.forEach(element => {
      const htmlElement = element as HTMLElement
      // Keep it simple - no visual changes, just enable clicking
      htmlElement.title = 'Click to edit'
    })
  }

  private selectElement(elementOrSelector: HTMLElement | string) {
    let element: HTMLElement | null = null
    
    if (typeof elementOrSelector === 'string') {
      element = document.querySelector(elementOrSelector)
    } else {
      element = elementOrSelector
    }

    if (!element) return

    // Clear previous selection - but don't modify any styles!
    // The parent editor overlay handles ALL visual feedback
    if (this.selectedElement) {
      this.selectedElement.removeAttribute('data-editor-selected')
    }

    // Set selected element and mark it with a data attribute
    // NEVER modify inline styles - this preserves all original styling
    this.selectedElement = element
    element.setAttribute('data-editor-selected', 'true')
    
    console.log('🎯 CLIENT: Selecting element:', element.getAttribute('data-editor-id'))
    console.log('🎯 CLIENT: Element type:', element.getAttribute('data-editor-type'))
    console.log('🎯 CLIENT: Element tag:', element.tagName)
    if (element.tagName === 'IMG') {
      console.log('🖼️ CLIENT: Image src:', (element as HTMLImageElement).src)
    }

    // Get element bounds and adjust for iframe context
    const bounds = element.getBoundingClientRect()
    
    // Build attributes object - include important attributes for different element types
    const attributes: Record<string, string> = {
      'data-editor-id': element.getAttribute('data-editor-id') || '',
      'data-editor-type': element.getAttribute('data-editor-type') || '',
      'data-editor-page': element.getAttribute('data-editor-page') || '',
    }
    
    // For image elements, include the src attribute
    if (element.tagName === 'IMG') {
      attributes.src = (element as HTMLImageElement).src
      attributes.alt = (element as HTMLImageElement).alt || ''
    }
    
    const elementData = {
      id: element.getAttribute('data-editor-id') || '',
      tagName: element.tagName,
      textContent: element.textContent || '',
      attributes,
      bounds: {
        top: bounds.top,
        left: bounds.left,
        right: bounds.right,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y
      }
    }
    
    console.log('🚀 CLIENT: Sending ELEMENT_SELECTED:', elementData)
    
    // Send element info to editor
    this.sendToEditor({
      type: 'ELEMENT_SELECTED',
      payload: { element: elementData }
    })
  }

  private deselectElement() {
    // Clear current selection using modern editor best practices
    if (this.selectedElement) {
      console.log('Deselecting element:', this.selectedElement.getAttribute('data-editor-id'))
      
      // Modern approach: NEVER modify inline styles
      // Just remove our selection marker attribute
      this.selectedElement.removeAttribute('data-editor-selected')
      
      console.log('Element styles preserved:', this.selectedElement.style.cssText)
      this.selectedElement = null
    }

    // Send deselection message to editor
    this.sendToEditor({
      type: 'ELEMENT_DESELECTED',
      payload: {}
    })
  }

  private updateElementContent(elementId: string, content: any) {
    console.log('🔄 CLIENT: updateElementContent called')
    console.log('🔄 CLIENT: Element ID:', elementId)
    console.log('🔄 CLIENT: Content:', content)
    
    const element = document.querySelector(`[data-editor-id="${elementId}"]`)
    console.log('🔄 CLIENT: Found element:', element?.tagName, element?.getAttribute('data-editor-type'))
    
    if (element) {
      const elementType = element.getAttribute('data-editor-type')
      
      if (elementType === 'image' && element.tagName === 'IMG') {
        // Handle image elements - update src attribute
        console.log('🖼️ CLIENT: Updating image src attribute')
        const imgElement = element as HTMLImageElement
        const oldSrc = imgElement.src
        imgElement.src = content
        console.log('✅ CLIENT: Image src updated from', oldSrc, 'to', content)
      } else if (typeof content === 'string') {
        // Handle text content
        console.log('📝 CLIENT: Updating text content')
        element.textContent = content
        console.log('✅ CLIENT: Text content updated to', content)
      }
      
      // Send confirmation back to editor
      console.log('📤 CLIENT: Sending CONTENT_CHANGED confirmation')
      this.sendToEditor({
        type: 'CONTENT_CHANGED',
        payload: {
          elementId,
          newContent: content
        }
      })
    } else {
      console.log('❌ CLIENT: Element not found for ID:', elementId)
    }
  }

  private enterEditMode(elementId: string) {
    const element = document.querySelector(`[data-editor-id="${elementId}"]`) as HTMLElement
    
    if (element && element.getAttribute('data-editor-type') === 'text') {
      element.contentEditable = 'true'
      element.focus()
      
      // Select all text
      const range = document.createRange()
      range.selectNodeContents(element)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)

      // Handle blur to exit edit mode
      element.addEventListener('blur', () => {
        this.exitEditMode()
      })

      // Handle enter key to save
      element.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          element.blur()
        }
      })
    }
  }

  private exitEditMode() {
    const editableElements = document.querySelectorAll('[contenteditable="true"]')
    
    editableElements.forEach(element => {
      const htmlElement = element as HTMLElement
      htmlElement.contentEditable = 'false'
      
      // Send updated content to editor
      const elementId = htmlElement.getAttribute('data-editor-id')
      if (elementId) {
        this.sendToEditor({
          type: 'CONTENT_CHANGED',
          payload: {
            elementId,
            newContent: htmlElement.textContent || ''
          }
        })
      }
    })
  }

  private sendToEditor(message: Omit<EditorMessage, 'messageId' | 'timestamp'>) {
    if (!this.isInEditorMode || !window.parent) return

    const fullMessage: EditorMessage = {
      ...message,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    }

    window.parent.postMessage(fullMessage, '*')
  }
}

// Initialize the bridge when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new ClientEditorBridge()
    })
  } else {
    new ClientEditorBridge()
  }
}

export { ClientEditorBridge }