import { fetchContentFromCMS, adjustBrightness, getImageProps } from '@/lib/content';

// ISR Configuration: Revalidate at most once per hour
export const revalidate = 3600;

// Generate metadata for SEO
export async function generateMetadata() {
  const content = await fetchContentFromCMS();
  
  return {
    title: content.pages.home.headline,
    description: content.pages.home.subhead,
    openGraph: {
      title: content.pages.home.headline,
      description: content.pages.home.subhead,
    }
  };
}

export default async function HomePage() {
  // This content is fetched at build time and revalidated via ISR
  const content = await fetchContentFromCMS();
  
  // Get image properties with proper fallback handling
  const imageProps = getImageProps(content.pages.home['hero-image']);
  
  return (
    <main 
      className="min-h-screen bg-white"
      style={{
        '--brand-color': content.config.brand_color,
        '--brand-hover': adjustBrightness(content.config.brand_color, -20)
      } as React.CSSProperties}
    >
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Dynamic headline */}
        <h1
          className="text-5xl font-bold text-gray-900 mb-6"
          data-editable="true"
          data-editor-id="headline"
          data-editor-type="text"
          data-editor-page="home"
        >
          {content.pages.home.headline}
        </h1>

        {/* Dynamic subheading */}
        <p
          className="text-xl text-gray-600 mb-8 max-w-2xl"
          data-editable="true"
          data-editor-id="subhead"
          data-editor-type="text"
          data-editor-page="home"
        >
          {content.pages.home.subhead}
        </p>

        {/* Dynamic CTA button */}
        {content.config.cta_button_enabled && (
          <button 
            className="text-white font-semibold py-4 px-8 rounded-lg text-lg transition-colors hover:opacity-90"
            style={{
              backgroundColor: 'var(--brand-color)',
            }}
            data-editable="true"
            data-editor-id="cta-text"
            data-editor-type="text"
            data-editor-page="home"
          >
            {content.pages.home['cta-text']}
          </button>
        )}
        
        {/* CTA Button toggle indicator for editor */}
        <div 
          data-editor-component="true"
          data-editor-id="cta-button"
          data-editor-type="toggle"
          data-editor-enabled={content.config.cta_button_enabled}
          style={{ display: 'none' }}
        >
          CTA Button Component
        </div>

        {/* Hero image for testing image replacement */}
        <div className="mt-16">
          <img
            src={imageProps.src}
            srcSet={imageProps.srcSet}
            alt={imageProps.alt}
            className="w-full max-w-2xl mx-auto rounded-lg shadow-lg"
            data-editable="true"
            data-editor-id="hero-image"
            data-editor-type="image"
            data-editor-page="home"
          />
        </div>
      </div>
      
      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-black text-white p-2 text-xs rounded">
          Last built: {new Date().toLocaleTimeString()}
        </div>
      )}
    </main>
  );
}
