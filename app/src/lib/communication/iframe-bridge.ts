// Iframe communication bridge utilities

import { EditorMessage, EditorCommunicationMessage, ContentValue } from './message-types'

class IframeBridge {
  private messageHandlers = new Map<string, (message: EditorCommunicationMessage) => void>()
  private allowedOrigins: string[] = []
  private messageQueue: EditorMessage[] = []
  private iframeRef: React.RefObject<HTMLIFrameElement | null> | null = null
  private isReady = false
  private isInitialized = false

  constructor() {
    // Only initialize on client side
    if (typeof window !== 'undefined') {
      this.setupMessageListener()
      this.isInitialized = true
    }
  }

  setAllowedOrigins(origins: string[]) {
    this.allowedOrigins = origins
  }

  setIframeRef(ref: React.RefObject<HTMLIFrameElement | null>) {
    this.iframeRef = ref
  }

  private setupMessageListener() {
    if (typeof window === 'undefined') return
    
    window.addEventListener('message', (event) => {
      // Security check: validate origin
      if (this.allowedOrigins.length > 0 && !this.allowedOrigins.includes(event.origin)) {
        console.warn('Ignoring message from unauthorized origin:', event.origin)
        return
      }

      try {
        const message: EditorCommunicationMessage = event.data

        // Validate message structure
        if (!message.type || !message.messageId || !message.timestamp) {
          console.warn('Invalid message structure:', message)
          return
        }

        // Handle iframe ready state
        if (message.type === 'IFRAME_READY') {
          this.isReady = true
          this.flushMessageQueue()
        }

        // Enhanced debugging for message reception
        console.log('📨 ADMIN: Received message from iframe:', message.type, message)
        if (message.type === 'ELEMENT_SELECTED') {
          console.log('📨 ADMIN: Element selected data:', message.payload?.element)
        }

        // Call registered handlers
        const handler = this.messageHandlers.get(message.type)
        if (handler) {
          console.log('🔧 ADMIN: Calling handler for message type:', message.type)
          handler(message)
        } else {
          console.log('❓ ADMIN: No handler registered for message type:', message.type)
        }
      } catch (error) {
        console.error('Error processing iframe message:', error)
      }
    })
  }

  // Register a message handler
  on<T extends EditorCommunicationMessage>(
    messageType: T['type'], 
    handler: (message: T) => void
  ) {
    this.messageHandlers.set(messageType, handler as (message: EditorCommunicationMessage) => void)
  }

  // Remove a message handler
  off(messageType: string) {
    this.messageHandlers.delete(messageType)
  }

  // Send message to iframe
  sendToIframe(message: Omit<EditorMessage, 'messageId' | 'timestamp'>) {
    if (!this.isInitialized) return
    
    const fullMessage: EditorMessage = {
      ...message,
      messageId: this.generateMessageId(),
      timestamp: Date.now()
    }

    if (!this.isReady) {
      // Queue messages until iframe is ready
      this.messageQueue.push(fullMessage)
      return
    }

    this.sendMessage(fullMessage)
  }

  private sendMessage(message: EditorMessage) {
    const iframe = this.iframeRef?.current
    if (!iframe?.contentWindow) {
      console.error('Iframe not available for messaging')
      return
    }

    try {
      iframe.contentWindow.postMessage(message, '*')
    } catch (error) {
      console.error('Error sending message to iframe:', error)
    }
  }

  private flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      if (message) {
        this.sendMessage(message)
      }
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Utility methods for common operations
  selectElement(selector: string) {
    this.sendToIframe({
      type: 'SELECT_ELEMENT',
      payload: { selector }
    })
  }

  updateContent(elementId: string, content: ContentValue) {
    this.sendToIframe({
      type: 'UPDATE_CONTENT',
      payload: { elementId, content }
    })
  }

  enterEditMode(elementId: string) {
    this.sendToIframe({
      type: 'ENTER_EDIT_MODE',
      payload: { elementId, mode: 'edit' }
    })
  }

  exitEditMode() {
    this.sendToIframe({
      type: 'EXIT_EDIT_MODE',
      payload: { mode: 'preview' }
    })
  }

  // Cleanup
  destroy() {
    this.messageHandlers.clear()
    this.messageQueue = []
    this.isReady = false
  }
}

// Lazy singleton instance - only create on client side
let iframeBridge: IframeBridge | null = null

function getIframeBridge(): IframeBridge {
  if (!iframeBridge && typeof window !== 'undefined') {
    iframeBridge = new IframeBridge()
  }
  return iframeBridge!
}

// Hook for React components
export function useIframeBridge() {
  const bridge = getIframeBridge()
  
  return {
    bridge,
    sendToIframe: bridge?.sendToIframe.bind(bridge) || (() => {}),
    selectElement: bridge?.selectElement.bind(bridge) || (() => {}),
    updateContent: bridge?.updateContent.bind(bridge) || (() => {}),
    enterEditMode: bridge?.enterEditMode.bind(bridge) || (() => {}),
    exitEditMode: bridge?.exitEditMode.bind(bridge) || (() => {}),
    on: bridge?.on.bind(bridge) || (() => {}),
    off: bridge?.off.bind(bridge) || (() => {})
  }
}

// Export the bridge getter for direct access
export { getIframeBridge as iframeBridge }