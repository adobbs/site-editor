// Message types for editor ↔ iframe communication

export interface BaseMessage {
  messageId: string
  timestamp: number
}

// Content value type union based on actual usage
export type ContentValue = string | boolean | number

// Messages sent from editor to iframe
export interface EditorMessage extends BaseMessage {
  type: 'EDITOR_READY' | 'UPDATE_CONTENT' | 'SELECT_ELEMENT' | 'ENTER_EDIT_MODE' | 'EXIT_EDIT_MODE'
  payload: {
    siteId?: string
    editorMode?: boolean
    selector?: string
    content?: ContentValue
    mode?: 'edit' | 'preview'
    elementId?: string
  }
}

// Messages sent from iframe to editor
export interface IframeMessage extends BaseMessage {
  type: 'IFRAME_READY' | 'ELEMENT_SELECTED' | 'CONTENT_CHANGED' | 'ELEMENT_CLICKED' | 'ELEMENT_DESELECTED' | 'ERROR'
  payload: {
    element?: {
      id: string
      tagName: string
      textContent?: string
      attributes?: Record<string, string>
      bounds?: DOMRect
    }
    content?: ContentValue
    error?: string
    ready?: boolean
    // Additional properties for CONTENT_CHANGED messages
    elementId?: string
    newContent?: ContentValue
    oldContent?: ContentValue
    type?: string
  }
}

export type EditorCommunicationMessage = EditorMessage | IframeMessage

// Content update types
export interface ContentUpdate {
  elementId: string
  type: 'text' | 'image' | 'toggle' | 'config'
  oldValue: ContentValue
  newValue: ContentValue
  timestamp: number
  // Image-specific metadata (optional)
  imageId?: string
  optimizedImagePath?: string
  imageSrcset?: string
  imageAltText?: string
}

// Editor state types (simplified for file-based system)
export interface EditorCommunicationState {
  currentSite: {
    id: string
    name: string
    slug: string
  }
  editingMode: 'preview' | 'edit'
  selectedElement: string | null
  draftChanges: Map<string, ContentUpdate>
  activePanel: 'text' | 'settings' | 'images' | 'publish'
  iframeReady: boolean
  hasUnsavedChanges: boolean
}

// EditorCommand interface removed - now using TanStack Store with EditorChange interface