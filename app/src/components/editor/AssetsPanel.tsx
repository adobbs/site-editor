'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Box,
  Grid, 
  Card, 
  Image, 
  Text, 
  Stack, 
  Group, 
  Button, 
  Alert,
  TextInput,
  Loader
} from '@mantine/core'
import { Upload, Search, Check } from 'lucide-react'
import { openImageUploadModal } from './ImageUploadModal'
import { FileWithPath } from '@mantine/dropzone'

interface ImageData {
  id: string
  fileName: string
  originalName: string
  publicUrl: string
  fileSize: number
  mimeType: string
  dimensions?: {
    width: number
    height: number
  } | null
  uploadedAt: string
  uploadedBy: string
}

interface AssetsPanelProps {
  siteId: string
  onSelectImage?: (image: { id: string, fileName: string, publicUrl: string }) => void
  onUploadNew?: () => void
  selectedImageId?: string | null
  showReplacementHint?: boolean
  onCancelReplacement?: () => void
}

// Image thumbnail component for tab layout
interface ImageThumbnailProps {
  image: ImageData
  isSelected: boolean
  onSelect: (image: ImageData) => void
}

function ImageThumbnail({ image, isSelected, onSelect }: ImageThumbnailProps) {
  return (
    <Card
      shadow="sm"
      padding="xs"
      radius="md"
      withBorder
      style={{ 
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        border: isSelected ? '3px solid var(--mantine-color-blue-6)' : undefined,
        transform: isSelected ? 'scale(0.98)' : undefined
      }}
      onClick={() => onSelect(image)}
    >
      <Card.Section>
        <Box pos="relative" style={{ aspectRatio: '1/1', overflow: 'hidden' }}>
          <Image
            src={image.publicUrl}
            alt={image.originalName}
            fit="cover"
            style={{ 
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
          {isSelected && (
            <Box
              pos="absolute"
              top={4}
              right={4}
              bg="blue"
              style={{ 
                borderRadius: '50%',
                width: 16,
                height: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Check size={10} color="white" />
            </Box>
          )}
        </Box>
      </Card.Section>

      <Box mt={4} px={2} pb={2}>
        <Text size="xs" fw={500} truncate title={image.originalName} style={{ fontSize: '10px' }}>
          {image.originalName}
        </Text>
      </Box>
    </Card>
  )
}

export function AssetsPanel({
  siteId,
  onSelectImage,
  onUploadNew,
  selectedImageId: _selectedImageId,
  showReplacementHint = false,
  onCancelReplacement
}: AssetsPanelProps) {
  const [images, setImages] = useState<ImageData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Filter images based on search query
  const filteredImages = images.filter(image =>
    image.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    image.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleDeselect = useCallback(() => {
    setSelectedImage(null)
  }, [])

  const loadImages = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/sites/${siteId}/images/list`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load images')
      }

      const data = await response.json()
      setImages(data.images || [])
    } catch (err) {
      console.error('Error loading images:', err)
      setError(err instanceof Error ? err.message : 'Failed to load images')
    } finally {
      setLoading(false)
    }
  }, [siteId])

  const handleImageSelect = useCallback((image: ImageData) => {
    setSelectedImage(image)
    
    // Immediately call the selection handler for instant preview
    if (onSelectImage) {
      onSelectImage(image)
    }
  }, [onSelectImage])

  const handleUploadImages = useCallback(async (files: FileWithPath[]) => {
    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Create form data for upload
      const formData = new FormData()

      // Add all files at once
      for (const file of files) {
        formData.append('files', file)
      }

      console.log('📤 Uploading', files.length, 'file(s) for site:', siteId)

      const response = await fetch(`/api/sites/${siteId}/images/upload`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown upload error' }))
        console.error('❌ Upload failed:', response.status, errorData)
        throw new Error(errorData.error || `Upload failed with status ${response.status}`)
      }

      const result = await response.json()
      console.log('✅ Upload successful:', result)

      setUploadProgress(100)

      // Refresh the images list
      await loadImages()

      console.log('✅ Images uploaded successfully')
    } catch (error) {
      console.error('❌ Upload failed:', error)
      throw error // Re-throw so the modal can handle it
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [siteId, loadImages])

  const handleUploadClick = useCallback(() => {
    openImageUploadModal({
      onUpload: handleUploadImages,
      siteId,
      isUploading,
      uploadProgress
    })
  }, [handleUploadImages, siteId, isUploading, uploadProgress])

  // Load images when component mounts
  useEffect(() => {
    if (siteId) {
      loadImages()
    }
  }, [siteId, loadImages])

  // Handle escape key to deselect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedImage) {
        handleDeselect()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedImage, handleDeselect])

  return (
    <Stack gap="sm" h="100%" p="sm" style={{ overflow: 'hidden' }}>
      {/* Dynamic hint message for image replacement */}
      {showReplacementHint && (
        <Alert color="blue" variant="light" p="xs">
          <Group justify="space-between" align="center">
            <Text size="xs" fw={500}>
              Select an image to replace the current one.
            </Text>
            <Button variant="subtle" size="xs" color="gray" onClick={() => onCancelReplacement?.()}>
              Cancel
            </Button>
          </Group>
        </Alert>
      )}
      
      {/* Search */}
      <TextInput
        placeholder="Search..."
        leftSection={<Search size={14} />}
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.currentTarget.value)}
        size="xs"
      />
      
      {/* Upload button */}
      <Button
        leftSection={<Upload size={14} />}
        onClick={handleUploadClick}
        variant="light"
        size="xs"
        fullWidth
        disabled={isUploading}
        loading={isUploading}
      >
        Upload
      </Button>

      {/* Content area */}
      <Box 
        style={{ flex: 1, overflow: 'auto' }}
        onClick={handleDeselect}
      >
        {loading && (
          <Stack align="center" justify="center" h={200}>
            <Loader />
            <Text c="dimmed" size="xs">Loading images...</Text>
          </Stack>
        )}

        {error && (
          <Alert color="red" title="Error loading images">
            {error}
          </Alert>
        )}

        {!loading && !error && filteredImages.length === 0 && (
          <Stack align="center" justify="center" h={200}>
            <Text c="dimmed" ta="center" size="xs">
              {searchQuery ? 'No images match your search' : 'No images uploaded yet'}
            </Text>
            {!searchQuery && (
              <Button variant="light" size="xs" onClick={handleUploadClick} disabled={isUploading}>
                Upload your first image
              </Button>
            )}
          </Stack>
        )}

        {!loading && !error && filteredImages.length > 0 && (
          <Grid 
            gutter="xs"
          >
            {filteredImages.map((image) => (
              <Grid.Col key={image.id} span={6} onClick={(e) => e.stopPropagation()}>
                <ImageThumbnail
                  image={image}
                  isSelected={selectedImage?.id === image.id}
                  onSelect={handleImageSelect}
                />
              </Grid.Col>
            ))}
          </Grid>
        )}
      </Box>

      {/* Footer info */}
      {selectedImage && (
        <Box 
          style={{ 
            borderTop: '1px solid #e9ecef',
            paddingTop: 8,
            flexShrink: 0
          }}
        >
          <Stack gap={2}>
            <Text size="xs" fw={500} truncate title={selectedImage.originalName}>
              {selectedImage.originalName}
            </Text>
            <Text size="xs" c="dimmed" style={{ fontSize: '10px' }}>
              Applied instantly
            </Text>
          </Stack>
        </Box>
      )}
    </Stack>
  )
}