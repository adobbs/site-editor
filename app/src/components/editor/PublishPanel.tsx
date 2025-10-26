'use client'

import { useState } from 'react'
import { Stack, Button, Text, Card, Group, Badge, Loader } from '@mantine/core'
import { Upload, CheckCircle } from 'lucide-react'
import { notifications } from '@mantine/notifications'
import { ContentUpdate } from '@/lib/communication/message-types'
import { useOriginalContent, usePublishedContent } from '@/lib/stores/editorStore'

// Helper function to count actual changes (changes that differ from original)
const countActualChanges = (draftChanges: Map<string, ContentUpdate>, originalContent: Map<string, unknown>): number => {
  let count = 0
  for (const [elementId, draftChange] of draftChanges) {
    const originalValue = originalContent.get(elementId)
    if (originalValue === undefined || draftChange.newValue !== originalValue) {
      count++
    }
  }
  return count
}

interface PublishPanelProps {
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
}

export function PublishPanel({
  site,
  draftChanges,
  hasUnsavedChanges,
  hasUnpublishedChanges,
  onPublishComplete,
  onClearDrafts,
  onMarkPublished,
  saveDraft
}: PublishPanelProps) {
  const [isPublishing, setIsPublishing] = useState(false)
  const originalContent = useOriginalContent()
  const publishedContent = usePublishedContent()
  
  // Count actual changes (changes that differ from original)
  const actualChangeCount = countActualChanges(draftChanges, originalContent)

  const handlePublish = async () => {
    if (!hasUnpublishedChanges) {
      notifications.show({
        title: 'No Changes',
        message: 'There are no changes to publish.',
        color: 'blue'
      })
      return
    }

    setIsPublishing(true)

    try {
      // Auto-save drafts first if there are unsaved changes
      if (hasUnsavedChanges && saveDraft) {
        try {
          await saveDraft()
        } catch (error) {
          console.error('Failed to auto-save drafts before publishing:', error)
          notifications.show({
            title: 'Save Failed',
            message: 'Could not save drafts before publishing. Please save manually first.',
            color: 'red'
          })
          return
        }
      }
      const changesArray = Array.from(draftChanges.values())

      const response = await fetch(`/api/sites/${site.id}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          changes: changesArray.map(change => ({
            pageSlug: 'home', // TODO: determine page from context
            blockKey: change.elementId
          }))
        })
      })

      const result = await response.json()

      if (!response.ok) {
        // Handle ISR configuration or failure cases
        if (result.error && result.publishedChanges > 0) {
          notifications.show({
            title: 'Published with ISR Warning',
            message: `${result.publishedChanges} change${result.publishedChanges !== 1 ? 's' : ''} published to database. ${result.error}`,
            color: 'yellow'
          })
        } else {
          throw new Error(result.error || 'Failed to publish changes')
        }
      } else {
        // Success case
        notifications.show({
          title: 'Published Successfully!',
          message: result.success 
            ? `${result.publishedChanges} change${result.publishedChanges !== 1 ? 's' : ''} published instantly via ISR (${result.responseTime})`
            : 'Changes published to database',
          color: 'green',
          icon: <CheckCircle size={16} />
        })
      }

      // Mark as published (clears unpublished changes flag)
      onMarkPublished?.()
      
      // Clear draft changes from local state after successful publish
      onClearDrafts?.()
      onPublishComplete?.()

    } catch (error) {
      console.error('Error publishing changes:', error)
      notifications.show({
        title: 'Publish Failed',
        message: 'There was an error publishing your changes. Please try again.',
        color: 'red'
      })
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div style={{
      background: 'white',
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      {/* Header - Badge and publish button */}
      <div style={{
        padding: 'var(--mantine-spacing-sm)',
        borderBottom: '1px solid #e9ecef'
      }}>
        
        <Button
          fullWidth
          leftSection={isPublishing ? <Loader size={16} /> : <Upload size={16} />}
          onClick={handlePublish}
          disabled={!hasUnpublishedChanges || isPublishing}
          loading={isPublishing}
        >
          {isPublishing ? 'Publishing...' : 'Publish to Live Site'}
        </Button>
      </div>

      {/* Changes List */}
      <div style={{
        flex: 1,
        padding: 'var(--mantine-spacing-sm)',
        overflowY: 'auto'
      }}>
        {hasUnpublishedChanges && (
          <Text size="sm" fw={500} mb="sm" c="gray.7">
            Draft Changes
          </Text>
        )}
        <Stack gap="sm">
          {Array.from(draftChanges.entries())
            .filter(([elementId, change]) => {
              const originalValue = originalContent.get(elementId)
              return originalValue === undefined || change.newValue !== originalValue
            })
            .map(([elementId, change]) => {
              // Use published content for "from" display, fallback to change.oldValue
              const publishedValue = publishedContent.get(elementId)
              const fromValue = publishedValue !== undefined ? publishedValue : change.oldValue
              
              return (
            <Card key={elementId} withBorder p="sm" radius="sm">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="xs" fw={500} c="gray.7">
                    {elementId}
                  </Text>
                  <Group gap="xs">
                    {/* Content status badge */}
                    {fromValue === '' || fromValue === null || fromValue === undefined ? (
                      <Badge size="xs" variant="light" color="green">
                        NEW
                      </Badge>
                    ) : (
                      <Badge size="xs" variant="light" color="blue">
                        EDIT
                      </Badge>
                    )}
                    {/* Content type badge */}
                    <Badge size="xs" variant="dot" color="gray">
                      {change.type}
                    </Badge>
                  </Group>
                </Group>
                
                {/* Before/After comparison */}
                <Stack gap="xs">
                  {/* Original value */}
                  <div>
                    <Text size="xs" c="gray.6" fw={500} mb={2}>
                      {fromValue === '' || fromValue === null || fromValue === undefined
                        ? 'New content:'
                        : 'Published:'
                      }
                    </Text>
                    <Text size="sm" c="gray.7" style={{ 
                      background: '#f8f9fa', 
                      padding: '4px 8px', 
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      fontStyle: (fromValue === '' || fromValue === null || fromValue === undefined) ? 'italic' : 'normal'
                    }} lineClamp={2}>
                      {fromValue === '' || fromValue === null || fromValue === undefined
                        ? '(Not yet published)'
                        : (typeof fromValue === 'string' 
                          ? fromValue 
                          : JSON.stringify(fromValue)
                        )
                      }
                    </Text>
                  </div>
                  
                  {/* New value */}
                  <div>
                    <Text size="xs" c="green.6" fw={500} mb={2}>
                      Draft:
                    </Text>
                    <Text size="sm" c="green.8" style={{ 
                      background: '#e6ffed', 
                      padding: '4px 8px', 
                      borderRadius: '4px',
                      fontFamily: 'monospace'
                    }} lineClamp={2}>
                      {typeof change.newValue === 'string' 
                        ? change.newValue 
                        : JSON.stringify(change.newValue)
                      }
                    </Text>
                  </div>
                </Stack>
              </Stack>
            </Card>
              )
            })}
          
          {!hasUnpublishedChanges && (
            <Text size="sm" c="gray.6" ta="center" py="xl">
              No draft changes to publish.
              <br />
              All content is up to date on the live site.
            </Text>
          )}
        </Stack>
      </div>

    </div>
  )
}