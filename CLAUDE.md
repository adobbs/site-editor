# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**dib** (design it better) is an open-source visual website builder that lets users edit content visually with a live preview editor. It's a file-based system (no database) that generates self-contained Next.js projects.

**Status**: v1.0.0-alpha - Early alpha, actively evolving

**Key Innovation**: Extracted from a multi-tenant SaaS project (cedric-growth) and converted to a single-tenant, file-based architecture.

## Development Commands

### Main dib Editor (app/)
```bash
cd app
npm install
npm run dev          # Start editor at localhost:3000
npm run build
npm run type-check   # TypeScript validation
```

### Generated Sites (templates/business or generated-sites/*)
```bash
cd templates/business  # or cd generated-sites/[site-name]
npm install
npm run dev          # Start site at localhost:3001
npm run build
npm run type-check
```

### Testing the Full System
1. Start dib editor: `cd app && npm run dev` (port 3000)
2. Start a generated site: `cd generated-sites/[site-name] && npm run dev` (port 3001)
3. Visit `http://localhost:3001/dib` to access the visual editor

## Critical Architecture Patterns

### 1. Dual-Server Development Model

dib requires **two separate dev servers** running simultaneously:

- **Editor App** (`app/`): The visual editor interface at `localhost:3000`
- **Generated Site** (`generated-sites/[site-name]/`): The actual website being edited at `localhost:3001`

Communication flows: Browser → Editor (3000) ↔ IframeBridge ↔ Site (3001)

### 2. Iframe-Based Editor Architecture

The visual editor embeds the target site in an iframe and communicates via PostMessage:

- **EditorInterface** (`app/src/components/editor/EditorInterface.tsx`): Main editor UI, toolbar, panels
- **IframeContainer** (`app/src/components/editor/IframeContainer.tsx`): Embeds the preview site
- **EditorOverlay** (`app/src/components/editor/EditorOverlay.tsx`): Intercepts clicks for inline editing
- **IframeBridge** (`app/src/lib/communication/iframe-bridge.ts`): PostMessage communication layer

The bridge handles:
- Origin validation for security
- Message queuing before iframe ready
- Click-to-edit element selection
- Content updates with live preview

### 3. File-Based Content System

**NO DATABASE** - All content stored as JSON files in each site's `content/` directory.

Content loading priority in generated sites (`templates/business/src/lib/content.ts`):
1. **First**: Try dib API (`DIB_API_BASE` env var) - used when editor is active
2. **Second**: Read local `content/site.json` file - normal site operation
3. **Fallback**: Hardcoded defaults - emergency only

Environment variables in generated sites (`.env.local`):
```bash
SITE_ID=my-site              # Must match directory name in generated-sites/
DIB_APP_URL=http://localhost:3000
DIB_API_BASE=http://localhost:3000  # Optional, enables live editing
```

### 4. State Management: TanStack Store with Undo/Redo

Editor state (`app/src/lib/stores/editorStore.ts`) uses TanStack Store with sophisticated undo/redo:

- **Past/Present/Future pattern**: History managed as change batches
- **Draft changes**: Unsaved edits stored in `Map<elementId, ContentUpdate>`
- **Original content**: Baseline for undo operations
- **Published content**: For comparing unpublished changes

Key actions:
- `addChange()`: Adds edit, creates undo point
- `undo()` / `redo()`: Navigates history
- `saveDraft()`: Persists to file system
- `loadDraftContent()`: Loads site content from API

### 5. Migration from Multi-Tenant (organization) to Single-Tenant (site)

**IMPORTANT**: The codebase was extracted from cedric-growth (a Supabase-backed multi-tenant app). When working with this code:

- Use `site` instead of `organization` (IDs, slugs, props)
- Use `siteId` instead of `organizationSlug`
- File paths: `/generated-sites/[siteId]/` NOT `/generated-sites/[org]/[site]/`
- No authentication, no database, no Supabase
- Image uploads go to local file system at `[siteId]/public/images/`

## API Routes (File-Based)

All routes in `app/src/app/api/sites/[siteId]/`:

```
GET  /api/sites/list                    # List generated sites
GET  /api/sites/[siteId]/content        # Read content/site.json
PUT  /api/sites/[siteId]/content        # Write content/site.json
POST /api/sites/[siteId]/publish        # Publish drafts to site.json
GET  /api/sites/[siteId]/images/list    # List images from public/images/
POST /api/sites/[siteId]/images/upload  # Upload to public/images/
```

**Critical Path Detail**:
- `SITES_DIR = path.join(process.cwd(), '..', 'generated-sites')`
- Site lookup: `${SITES_DIR}/${siteId}/content/site.json`
- Images: `${SITES_DIR}/${siteId}/public/images/`

## Content Format

Sites use a structured JSON format (`content/site.json`):

```json
{
  "site": { "id": "...", "slug": "...", "name": "..." },
  "config": {
    "brand_color": "#2563EB",
    "cta_button_enabled": true
  },
  "pages": {
    "home": {
      "headline": "...",
      "subhead": "...",
      "cta-text": "...",
      "hero-image": "/images/hero-image.png"
    }
  }
}
```

Images can be either:
- Simple string: `"/images/hero.png"`
- ImageBlock object: `{ "src": "...", "srcset": "...", "alt": "...", "type": "image" }`

## Creating a New Site from Template

```bash
# From dib root
cp -r templates/business generated-sites/my-site
cd generated-sites/my-site
npm install

# Create .env.local with:
# SITE_ID=my-site
# DIB_APP_URL=http://localhost:3000
# DIB_API_BASE=http://localhost:3000

npm run dev  # Runs on port 3001
```

Visit `http://localhost:3001/dib` to edit (redirects to editor at port 3000)

## Common Issues

### "Site not found" 404 errors
- Check `SITE_ID` in `.env.local` matches directory name exactly
- Directory structure must be flat: `generated-sites/[siteId]/` NOT `generated-sites/[folder]/[siteId]/`

### Images not loading
- Image files must exist in `public/images/`
- Content file must reference with correct path: `/images/filename.png`
- Check `fetchContentFromCMS()` is reading local JSON file correctly

### Editor can't connect to site
- Both servers must be running (ports 3000 and 3001)
- Check `DIB_API_BASE` in site's `.env.local`
- Verify iframe origin is in allowed list

## Tech Stack

- **Next.js 15** with App Router (React 19, TypeScript)
- **Mantine v8** for UI components
- **TanStack Store** for state management
- **PostCSS** with Tailwind v4 (in templates)
- **No database** - pure file system operations

## Branding

Use lowercase: "design it better" (not "Design It Better")

## Not Accepting External Contributions

This project is in early alpha and not yet open to external contributions. See CONTRIBUTING.md.
