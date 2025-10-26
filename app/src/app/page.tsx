import { Container, Title, Text, Stack } from '@mantine/core'

export default function HomePage() {
  return (
    <Container size="md" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Stack align="center" gap="md">
        <Title order={1} size="4rem">dib</Title>
        <Title order={2} size="2rem" c="dimmed">design it better</Title>
        <Text size="lg" c="dimmed" ta="center">
          Open source visual website builder
          <br />
          Create with AI, edit visually, own your code
        </Text>
      </Stack>
    </Container>
  )
}
