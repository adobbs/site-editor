'use client'

import { useState, useEffect } from 'react'
import { Stack, Text, Card, Group, Switch, Loader, Alert, Box } from '@mantine/core'
import { useEditorState } from '@/lib/hooks/useEditorState'

interface SettingsPanelProps {
  organization: {
    id: string
    name: string
    slug: string
  }
  onSettingsChange?: () => void
}

export function SettingsPanel({ organization, onSettingsChange }: SettingsPanelProps) {
  const [ctaButtonEnabled, setCtaButtonEnabled] = useState(false)
  const [draftCtaButtonEnabled, setDraftCtaButtonEnabled] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Use editor state for draft management
  const { addChange } = useEditorState(organization.slug)

  // Fetch current config including draft values
  useEffect(() => {
    if (organization.slug) {
      fetch(`/api/content/draft/${organization.slug}`)
        .then(res => res.json())
        .then(data => {
          if (data.config) {
            // Set published value
            setCtaButtonEnabled(data.config.cta_button_enabled ?? true)
            // Set draft value (null means no draft changes)
            setDraftCtaButtonEnabled(data.config.draft_cta_button_enabled)
          }
          setError(null)
        })
        .catch(err => {
          console.error('Error fetching settings:', err)
          setError('Failed to load settings')
        })
        .finally(() => {
          setIsLoading(false)
        })
    }
  }, [organization.slug])

  // Function to toggle CTA button (now saves to draft)
  const toggleCtaButton = (enabled: boolean) => {
    console.log('🎛️ CTA button toggle:', enabled)
    
    // Update local draft state immediately for UI responsiveness
    setDraftCtaButtonEnabled(enabled)
    
    // Add change to editor state (triggers auto-save)
    addChange({
      elementId: 'cta_button_enabled',
      type: 'config',
      oldValue: draftCtaButtonEnabled ?? ctaButtonEnabled,
      newValue: enabled,
      timestamp: Date.now()
    })

    // Notify parent component of settings change
    onSettingsChange?.()
  }

  if (isLoading) {
    return (
      <Stack align="center" justify="center" h={200} gap="sm">
        <Loader size="sm" />
        <Text c="dimmed" size="xs">Loading settings...</Text>
      </Stack>
    )
  }

  if (error) {
    return (
      <Stack gap="sm" h="100%" p="sm">
        <Alert color="red" title="Error loading settings">
          {error}
        </Alert>
      </Stack>
    )
  }

  return (
    <Stack gap="sm" h="100%" p="sm" style={{ overflow: 'hidden' }}>

      {/* Settings Cards */}
      <Card withBorder p="md" radius="md">
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Box>
              <Text size="sm" fw={500}>CTA Button</Text>
              <Text size="xs" c="dimmed">
                Show or hide the call-to-action button on your site
              </Text>
            </Box>
            <Switch
              checked={draftCtaButtonEnabled ?? ctaButtonEnabled}
              onChange={(event) => toggleCtaButton(event.currentTarget.checked)}
              size="sm"
            />
          </Group>
          
          {/* Show draft indicator */}
          {draftCtaButtonEnabled !== null && draftCtaButtonEnabled !== ctaButtonEnabled && (
            <Group gap="xs" justify="center">
              <Text size="xs" c="orange" fw={500}>
                Draft: {draftCtaButtonEnabled ? 'Enabled' : 'Disabled'}
              </Text>
            </Group>
          )}
        </Stack>
      </Card>

      {/* Info */}
      <Text size="xs" c="dimmed" ta="center" mt="auto" p="xs">
        Changes are saved as drafts and published via the Publish tab
      </Text>
    </Stack>
  )
}