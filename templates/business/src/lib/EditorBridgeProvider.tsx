'use client'

import { useEffect } from 'react'

export function EditorBridgeProvider() {
  useEffect(() => {
    // Dynamic import of editor bridge to ensure it runs on client side
    import('./editor-bridge')
      .then(() => {
        console.log('Editor bridge initialized')
      })
      .catch((error) => {
        console.error('Failed to initialize editor bridge:', error)
      })
  }, [])

  return null // This component doesn't render anything
}