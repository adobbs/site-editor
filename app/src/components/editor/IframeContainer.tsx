'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { notifications } from '@mantine/notifications'
import { useIframeBridge } from '@/lib/communication/iframe-bridge'

interface IframeContainerProps {
  src: string
  onLoad?: () => void
  organization: {
    id: string
    name: string
    slug: string
  }
}

export function IframeContainer({ src, onLoad, organization }: IframeContainerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [hasError, setHasError] = useState(false)
  const { bridge } = useIframeBridge()

  // Connect the iframe ref to the bridge immediately
  useEffect(() => {
    if (bridge) {
      bridge.setIframeRef(iframeRef)
    }
  }, [bridge])

  const handleIframeLoad = useCallback(() => {
    setHasError(false)
    onLoad?.()
    
    // Set up PostMessage communication and inject editor styles
    try {
      const iframe = iframeRef.current
      if (iframe?.contentWindow) {
        // Send initial editor ready message
        iframe.contentWindow.postMessage({
          type: 'EDITOR_READY',
          payload: {
            organizationSlug: organization.slug,
            editorMode: true
          }
        }, '*')

        // Keep it simple - no style injection
      }
    } catch (error) {
      console.error('Error setting up iframe communication:', error)
    }
  }, [onLoad, organization.slug])

  const handleIframeError = useCallback(() => {
    setHasError(true)
    notifications.show({
      title: 'Connection Error',
      message: `Could not load ${organization.name} website. Please check if the site is running.`,
      color: 'red'
    })
  }, [organization.name])

  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      position: 'relative',
      background: '#f8f9fa'
    }}>
      <iframe
        ref={iframeRef}
        src={src}
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '0',
          background: 'white'
        }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="clipboard-read; clipboard-write"
        title={`${organization.name} Website Editor`}
      />
      
      {/* Error State */}
      {hasError && (
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
          gap: '1rem'
        }}>
          <div style={{ fontSize: '2rem' }}>⚠️</div>
          <h3 style={{ margin: 0, color: '#495057' }}>Connection Error</h3>
          <p style={{ margin: 0, color: '#6c757d', textAlign: 'center' }}>
            Could not load {organization.name} website.<br />
            Please check if the site is running on {src}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}