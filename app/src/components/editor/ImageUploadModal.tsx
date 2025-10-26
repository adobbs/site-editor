'use client'

import { useState, useCallback } from 'react'
import { Group, Text, rem, Button, Progress, Alert, Stack } from '@mantine/core'
import { Dropzone, DropzoneProps, IMAGE_MIME_TYPE, FileWithPath, FileRejection } from '@mantine/dropzone'
import { Upload, X, Image, Check } from 'lucide-react'
import { modals } from '@mantine/modals'

interface ImageUploadContentProps {
  onUpload: (files: FileWithPath[]) => Promise<void>
  siteId: string
  isUploading?: boolean
  uploadProgress?: number
}

export function ImageUploadContent({
  onUpload,
  siteId: _siteId,
  isUploading = false,
  uploadProgress = 0
}: ImageUploadContentProps) {
  const [files, setFiles] = useState<FileWithPath[]>([])
  const [error, setError] = useState<string | null>(null)
  const [uploadComplete, setUploadComplete] = useState(false)

  const handleDrop: DropzoneProps['onDrop'] = useCallback((acceptedFiles) => {
    setFiles(acceptedFiles)
    setError(null)
    setUploadComplete(false)
  }, [])

  const handleReject: DropzoneProps['onReject'] = useCallback((rejectedFiles: FileRejection[]) => {
    const file = rejectedFiles[0]
    if (file.errors[0]?.code === 'file-too-large') {
      setError('File size must be less than 10MB')
    } else if (file.errors[0]?.code === 'file-invalid-type') {
      setError('Only JPEG, PNG, and WebP images are allowed')
    } else {
      setError('File upload failed. Please try again.')
    }
  }, [])

  const handleUpload = useCallback(async () => {
    if (files.length === 0) return

    try {
      setError(null)
      await onUpload(files)
      setUploadComplete(true)

      // Reset state after successful upload
      setTimeout(() => {
        setFiles([])
        setUploadComplete(false)
        modals.closeAll()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }, [files, onUpload])

  const handleClose = useCallback(() => {
    if (!isUploading) {
      setFiles([])
      setError(null)
      setUploadComplete(false)
      modals.closeAll()
    }
  }, [isUploading])

  const previews = files.map((file, index) => {
    const imageUrl = URL.createObjectURL(file)
    return (
      <div key={index} className="relative">
        <img
          src={imageUrl}
          alt={`Preview ${index + 1}`}
          style={{ width: '100%', maxWidth: rem(240), height: rem(140), objectFit: 'cover', borderRadius: rem(8) }}
          onLoad={() => URL.revokeObjectURL(imageUrl)}
        />
        <Text size="sm" mt="xs" ta="center" truncate>
          {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
        </Text>
      </div>
    )
  })

  return (
    <Stack gap="md">
        {error && (
          <Alert color="red" title="Upload Error" icon={<X size={16} />}>
            {error}
          </Alert>
        )}

        {uploadComplete && (
          <Alert color="green" title="Upload Complete" icon={<Check size={16} />}>
            Images uploaded successfully! This dialog will close automatically.
          </Alert>
        )}

        {isUploading && (
          <div>
            <Text size="sm" mb="xs">Uploading images...</Text>
            <Progress value={uploadProgress} size="lg" radius="md" />
          </div>
        )}

        <Dropzone
          onDrop={handleDrop}
          onReject={handleReject}
          maxSize={10 * 1024 * 1024} // 10MB
          accept={IMAGE_MIME_TYPE}
          multiple
          disabled={isUploading}
        >
          <Group justify="center" gap="xl" mih={220} style={{ pointerEvents: 'none' }}>
            <Dropzone.Accept>
              <Upload
                style={{
                  width: rem(52),
                  height: rem(52),
                  color: 'var(--mantine-color-blue-6)',
                }}
                strokeWidth={1.5}
              />
            </Dropzone.Accept>
            <Dropzone.Reject>
              <X
                style={{
                  width: rem(52),
                  height: rem(52),
                  color: 'var(--mantine-color-red-6)',
                }}
                strokeWidth={1.5}
              />
            </Dropzone.Reject>
            <Dropzone.Idle>
              <Image
                style={{
                  width: rem(52),
                  height: rem(52),
                  color: 'var(--mantine-color-dimmed)',
                }}
                strokeWidth={1.5}
              />
            </Dropzone.Idle>

            <div>
              <Text size="xl" inline>
                Drag images here or click to select files
              </Text>
              <Text size="sm" c="dimmed" inline mt={7}>
                Attach JPEG, PNG, or WebP images (max 10MB each)
              </Text>
            </div>
          </Group>
        </Dropzone>

        {files.length > 0 && (
          <div>
            <Text size="lg" fw={500} mb="md">
              Selected Images ({files.length})
            </Text>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: rem(16) }}>
              {previews}
            </div>
          </div>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={files.length === 0 || isUploading}
            loading={isUploading}
          >
            Upload {files.length > 0 ? `${files.length} image${files.length > 1 ? 's' : ''}` : 'Images'}
          </Button>
        </Group>
    </Stack>
  )
}

// Helper function to open the image upload modal
export function openImageUploadModal({
  onUpload,
  siteId,
  isUploading,
  uploadProgress
}: ImageUploadContentProps) {
  modals.open({
    modalId: 'image-upload',
    title: `Upload Images`,
    size: 'lg',
    centered: true,
    closeOnClickOutside: !isUploading,
    closeOnEscape: !isUploading,
    withCloseButton: !isUploading,
    overlayProps: {
      backgroundOpacity: 0.55,
      blur: 2,
    },
    zIndex: 9999,
    children: (
      <ImageUploadContent
        onUpload={onUpload}
        siteId={siteId}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
      />
    ),
  })
}
