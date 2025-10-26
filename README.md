# dib - Design It Better

> Open source web and product design tool

## What is dib?

For version 1, dib is an open-source website builder that lets you:
- ✨ Create professional websites with simple wizards
- 🎨 Edit content visually with a live preview editor
- 📦 Export as self-contained Next.js projects
- 🚀 Deploy anywhere (Vercel, Netlify, or self-host)
- 💾 Own your code and content (no vendor lock-in)

## Features

- **Visual Editor**: Click-to-edit interface with real-time preview
- **Undo/Redo**: Full history tracking with sophisticated state management
- **File-Based**: Content stored as JSON files, easy to version control
- **Template System**: Start with professional, customizable templates
- **Modern Stack**: Built with Next.js 15, React 19, TypeScript, Mantine UI
- **No Database Required**: Everything runs locally, no complex setup

## Quick Start

### Step 1: Set up dib editor

```bash
# Clone the repository
git clone https://github.com/adobbs/dib.git
cd dib

# Install dependencies for main app
cd app
npm install

# Start the dib editor
npm run dev
```

The dib editor will run at `http://localhost:3000`

### Step 2: Create your first site from template

```bash
# From dib root directory
cp -r templates/business generated-sites/my-business

# Navigate to your site
cd generated-sites/my-business

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Edit .env.local and set:
# SITE_ID=my-business
# DIB_APP_URL=http://localhost:3000

# Start your site
npm run dev
```

Your site will run at `http://localhost:3001`

### Step 3: Edit visually

Visit `http://localhost:3001/dib` and you'll be redirected to the visual editor!

## Project Structure

```
dib/
├── app/                    # Main application
│   ├── src/
│   │   ├── app/            # Next.js app router
│   │   ├── components/
│   │   │   ├── creator/    # Site creation wizard
│   │   │   ├── editor/     # Visual editor components
│   │   │   └── ui/         # Shared UI components
│   │   └── lib/
│   │       ├── stores/     # TanStack Store state management
│   │       ├── communication/ # Iframe bridge for editor
│   │       └── content/    # File-based content system
│   └── package.json
│
├── templates/              # Site templates
│   └── business/          # Generic business template
│
├── generated-sites/       # Your created sites (git-ignored)
│
└── examples/              # Example generated sites
```

## How It Works

### 1. Copy Template
Start with a professional template:
- Copy `templates/business` to `generated-sites/your-site-name`
- Edit `content/site.json` with your business info
- Replace images in `/public/images/`
- Customize colors and settings in the content file

### 2. Edit Visually
Powerful visual editor with:
- Click any text to edit inline
- Replace images with your own
- Toggle components on/off
- Change colors and settings
- Full undo/redo support
- Access via `/dib` route on your site

### 3. Build & Deploy
Your site is a complete Next.js project:
- Run `npm run build` to generate static site
- Deploy to Vercel, Netlify, or anywhere
- Self-host on your own infrastructure
- No export needed - it's already a standalone project!

## Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI**: Mantine v8 components
- **State**: TanStack Store for editor state management
- **Styling**: PostCSS with Mantine presets
- **Content**: File-based JSON storage

## Architecture Highlights

### Visual Editor
The visual editor uses an iframe-based architecture with PostMessage communication:
- **EditorInterface**: Main editor UI with toolbar and panels
- **IframeContainer**: Embeds the preview site
- **EditorOverlay**: Click-to-edit functionality
- **TanStack Store**: Sophisticated undo/redo with history management

### File-Based Content
No database required - everything is stored as files:
- `/generated-sites/[siteId]/content/site.json` - Site content and config
- `/generated-sites/[siteId]/src/` - Next.js application code
- `/generated-sites/[siteId]/public/` - Images and assets

### API Routes
- `GET /api/sites/list` - List all generated sites
- `GET /api/sites/[siteId]/content` - Load site content
- `PUT /api/sites/[siteId]/content` - Save site content
- `POST /api/sites/[siteId]/publish` - Publish draft changes

## Development Status

**Current Version**: 1.0.0-alpha
**Status**: Early alpha - functional but evolving

### ✅ Completed
- [x] Project structure and setup
- [x] Mantine UI integration with visual editor
- [x] TanStack Store state management (undo/redo)
- [x] Iframe communication system
- [x] File-based content API routes
- [x] Visual editor components (extracted from cedric-growth)
- [x] Business template (genericized)
- [x] `/dib` route for editor access

### 📋 Planned for v1.0
- [ ] End-to-end testing and polish
- [ ] Example site with full content
- [ ] Deployment documentation

### 🚀 Future (v2+)
- [ ] AI content generation
- [ ] More templates (Portfolio, Blog, Landing, Agency)
- [ ] Simple site creation wizard
- [ ] Export as ZIP functionality

## Contributing

This project is currently in **early alpha development** and is not yet accepting external contributions.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for more information.

If you have feedback or find bugs, please open an issue!

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Built By

Created by Andrew Dobbs as an exploration of AI-powered visual design tools.

## Acknowledgments

- Inspired by Webflow, Framer, and other visual design tools
- Standing on the shoulders of giants: Next.js, React, Mantine, and the open-source community

---

**Note**: This is v1.0 alpha. The project is functional but still evolving. Expect changes and improvements!
