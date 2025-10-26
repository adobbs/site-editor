'use client'

import { useState, useEffect } from 'react'
import { 
  Tabs,
  Box
} from '@mantine/core'
import { PublishPanel } from './PublishPanel'
import { AssetsPanel } from './AssetsPanel'
import { SettingsPanel } from './SettingsPanel'
import { ContentUpdate } from '@/lib/communication/message-types'
import styles from './RightPanel.module.css'


interface RightPanelProps {
  site: {
    id: string
    name: string
    slug: string
  }
  draftChanges: Map<string, ContentUpdate>
  hasUnsavedChanges: boolean
  hasUnpublishedChanges: boolean
  onPublishComplete?: () => void
  onClearDrafts?: () => void
  onMarkPublished?: () => void
  saveDraft?: () => Promise<void>
  
  // Asset picker props  
  showAssetPicker: boolean
  onSelectImage?: (image: { id: string, fileName: string, publicUrl: string }) => void
  onUploadNew?: () => void
  selectedImageId?: string | null
  onCancelReplacement?: () => void
}

export function RightPanel({
  site,
  draftChanges,
  hasUnsavedChanges,
  hasUnpublishedChanges,
  onPublishComplete,
  onClearDrafts,
  onMarkPublished,
  saveDraft,
  showAssetPicker,
  onSelectImage,
  onUploadNew,
  selectedImageId,
  onCancelReplacement
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<string>('publish')

  // Auto-switch to assets tab when asset picker is shown
  useEffect(() => {
    if (showAssetPicker) {
      setActiveTab('assets')
    }
  }, [showAssetPicker])

  // Handle tab change
  const handleTabChange = (value: string | null) => {
    if (value === 'publish') {
      setActiveTab('publish')
    } else if (value === 'assets') {
      setActiveTab('assets')
    } else if (value === 'settings') {
      setActiveTab('settings')
    }
  }

  return (
    <Box
      data-right-panel
      style={{
        width: '320px',
        height: '100%',
        borderLeft: '1px solid #e9ecef',
        backgroundColor: 'white',
        display: 'flex',
        flexDirection: 'column'
      }}
      onClick={(e) => {
        // Deselect image when clicking on empty panel areas
        if (e.target === e.currentTarget) {
          // This would need to communicate back to clear selection
          onCancelReplacement?.()
        }
      }}
    >
      <Tabs 
        value={activeTab} 
        onChange={handleTabChange}
        variant="none"
      >
        <Tabs.List className={styles.tabsList}>
          <Tabs.Tab 
            value="publish" 
            className={`${styles.tab} ${activeTab === 'publish' ? styles.tabActive : ''}`}
          >
            Publish
          </Tabs.Tab>
          <Tabs.Tab 
            value="assets" 
            className={`${styles.tab} ${activeTab === 'assets' ? styles.tabActive : ''}`}
          >
            Assets
          </Tabs.Tab>
          <Tabs.Tab 
            value="settings" 
            className={`${styles.tab} ${activeTab === 'settings' ? styles.tabActive : ''}`}
          >
            Settings
          </Tabs.Tab>
        </Tabs.List>

        <Box style={{ flex: 1, overflow: 'hidden' }}>
          <Tabs.Panel value="publish" style={{ height: '100%' }}>
            <PublishPanel
              site={site}
              draftChanges={draftChanges}
              hasUnsavedChanges={hasUnsavedChanges}
              hasUnpublishedChanges={hasUnpublishedChanges}
              onPublishComplete={onPublishComplete}
              onClearDrafts={onClearDrafts}
              onMarkPublished={onMarkPublished}
              saveDraft={saveDraft}
            />
          </Tabs.Panel>

          <Tabs.Panel value="assets" style={{ height: '100%' }}>
            <AssetsPanel
              siteId={site.id}
              onSelectImage={onSelectImage}
              onUploadNew={onUploadNew}
              selectedImageId={selectedImageId}
              showReplacementHint={showAssetPicker}
              onCancelReplacement={onCancelReplacement}
            />
          </Tabs.Panel>

          <Tabs.Panel value="settings" style={{ height: '100%' }}>
            <SettingsPanel
              site={site}
            />
          </Tabs.Panel>
        </Box>
      </Tabs>
    </Box>
  )
}