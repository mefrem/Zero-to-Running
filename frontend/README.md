# Frontend Service

React-based user interface for Zero-to-Running.

## Overview

This directory contains the frontend application built with:
- **React 18+** - Modern React with hooks and concurrent features
- **TypeScript** - Type-safe development with strict mode enabled
- **Tailwind CSS** - Utility-first CSS framework for styling
- **Vite** - Lightning-fast build tool and development server

## Quick Start

### Development with Docker (Recommended)

```bash
# From project root
docker-compose up frontend

# Or start all services
make dev
```

The frontend will be available at `http://localhost:3000`

### Local Development (Without Docker)

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Port Configuration

- **Development server**: `http://localhost:3000` (configurable via `PORT` or `FRONTEND_PORT` env var)
- **Hot reload**: Enabled via Vite HMR (React Fast Refresh)
- **API endpoint**: `http://localhost:3001` (configurable via `VITE_API_URL` env var)

## Environment Variables

The following environment variables configure the frontend:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` or `FRONTEND_PORT` | `3000` | Development server port |
| `VITE_API_URL` | `http://localhost:3001` | Backend API base URL |
| `NODE_ENV` | `development` | Node environment (development/production) |

**Note**: Vite environment variables must be prefixed with `VITE_` to be exposed to the client-side code.

### Setting Environment Variables

1. Copy `.env.example` to `.env` in project root:
   ```bash
   cp .env.example .env
   ```

2. Update values in `.env`:
   ```env
   FRONTEND_PORT=3000
   VITE_API_URL=http://localhost:3001
   ```

3. Restart the development server to apply changes

## Project Structure

```
frontend/
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration (strict mode)
├── vite.config.ts        # Vite bundler configuration
├── tailwind.config.js    # Tailwind CSS customization
├── postcss.config.js     # PostCSS with Tailwind plugin
├── index.html            # HTML entry point
├── .gitignore            # Git ignore patterns
├── src/                  # Source code
│   ├── main.tsx          # React application entry point
│   ├── index.css         # Global styles with Tailwind directives
│   ├── App.tsx           # Root component with landing page
│   ├── config/           # Configuration modules
│   │   └── api.ts        # API client and URL configuration
│   └── components/       # Reusable UI components (future)
├── public/               # Static assets
│   └── vite.svg          # Favicon
└── node_modules/         # Dependencies (git-ignored)
```

## Features

### Landing Page

The default landing page (`App.tsx`) displays:
- **"Zero-to-Running Environment - Ready!"** heading
- **Backend health status** with visual indicators:
  - 🟢 Green: Backend API healthy
  - 🟡 Yellow: Backend API unhealthy
  - 🔴 Red: Backend API unavailable
  - ⚪ Gray (pulsing): Checking status
- **Connection details**: Timestamp, API URL, and port information
- **Auto-refresh**: Health status polls every 30 seconds

### Hot Module Replacement (HMR)

Vite provides instant feedback during development:
- Code changes reflect immediately without full page reload
- React state preserved across updates
- TypeScript errors shown in browser console
- Works seamlessly inside Docker containers

## API Integration

### Making API Calls

The frontend includes a pre-configured API client in `src/config/api.ts`:

```typescript
import { fetchHealth } from './config/api';

// Example: Fetch backend health status
const healthData = await fetchHealth();
console.log(healthData); // { status: "ok", timestamp: "2024-..." }
```

### API URL Configuration

The API base URL is configured via environment variable:
- **Development**: `http://localhost:3001` (backend running locally or in Docker)
- **Docker Network**: `http://backend:3001` (if frontend calls backend within Docker network)
- **Production**: Set `VITE_API_URL` to your production API URL

## Tailwind CSS

Tailwind CSS is pre-configured and ready to use:

### Usage Example

```tsx
<div className="bg-blue-500 text-white p-4 rounded-lg">
  <h1 className="text-2xl font-bold">Hello World</h1>
</div>
```

### Customization

Edit `tailwind.config.js` to customize theme, colors, fonts, etc.:

```javascript
export default {
  theme: {
    extend: {
      colors: {
        'brand-blue': '#1e40af',
      },
    },
  },
}
```

### Utility Classes

Tailwind provides utility classes for:
- Layout: `flex`, `grid`, `container`
- Spacing: `m-4`, `p-6`, `space-x-2`
- Typography: `text-xl`, `font-bold`, `leading-tight`
- Colors: `bg-blue-500`, `text-red-600`
- Responsive: `md:flex`, `lg:grid-cols-3`

See [Tailwind CSS documentation](https://tailwindcss.com/docs) for complete reference.

## Docker Configuration

### Dockerfile

The frontend uses a multi-stage Dockerfile (`infrastructure/docker/Dockerfile.frontend`):
1. **Development stage**: Runs Vite dev server with HMR enabled
2. **Build stage**: Compiles TypeScript and builds production bundle
3. **Production stage**: Serves static files with Nginx

### Docker Compose

The frontend service is defined in `docker-compose.yml`:
- **Base image**: `node:20-alpine` (lightweight Node.js)
- **Volumes**: Source code mounted for hot reload
- **Ports**: Exposes port 3000 (configurable)
- **Dependencies**: Waits for backend to be healthy before starting
- **Network**: Connected to `zero-to-running-network` for inter-service communication

## Troubleshooting

### Hot Reload Not Working

If code changes don't reflect in the browser:

1. **Check Vite config**: Ensure `watch.usePolling: true` in `vite.config.ts` (required for Docker)
2. **Restart container**: `docker-compose restart frontend`
3. **Clear browser cache**: Hard refresh with Ctrl+Shift+R (or Cmd+Shift+R on Mac)
4. **Check console**: Look for HMR connection errors in browser DevTools

### API Connection Errors

If health status shows "unavailable":

1. **Check backend is running**: `docker-compose ps backend`
2. **Verify API URL**: Check `VITE_API_URL` in `.env` matches backend port
3. **Check CORS**: Backend must allow requests from `http://localhost:3000`
4. **Network tab**: Open browser DevTools → Network tab to see actual request/response

### Port Already in Use

If port 3000 is already in use:

1. **Change port**: Set `FRONTEND_PORT=3001` in `.env`
2. **Kill existing process**: `lsof -ti:3000 | xargs kill` (Mac/Linux)
3. **Use Docker**: Docker handles port mapping automatically

### TypeScript Errors

If you see TypeScript compilation errors:

1. **Check tsconfig.json**: Ensure proper configuration
2. **Install types**: `npm install --save-dev @types/package-name`
3. **Restart dev server**: `npm run dev` or restart Docker container
4. **Check imports**: Verify all imports have correct paths and types

### Build Failures

If `npm run build` fails:

1. **Fix TypeScript errors**: TypeScript must compile with zero errors
2. **Check dependencies**: Run `npm install` to ensure all packages installed
3. **Clear cache**: Delete `node_modules` and `package-lock.json`, then `npm install`
4. **Check disk space**: Ensure sufficient disk space for build output

## Development Workflow

1. **Start services**: `docker-compose up` or `make dev`
2. **Open browser**: Navigate to `http://localhost:3000`
3. **Edit code**: Make changes to files in `src/`
4. **See results**: Browser updates automatically via HMR
5. **Check health**: Verify backend connection via health status indicator
6. **Debug**: Use browser DevTools (F12) for debugging

## Scripts

Available npm scripts:

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Start Vite dev server with HMR |
| `build` | `npm run build` | Build production bundle |
| `preview` | `npm run preview` | Preview production build locally |
| `lint` | `npm run lint` | Run ESLint on TypeScript files |

## Next Steps

Future enhancements (upcoming stories):
- [ ] Add routing with React Router
- [ ] Implement state management (Context API or Redux)
- [ ] Add authentication and protected routes
- [ ] Create reusable component library
- [ ] Add unit tests with Vitest
- [ ] Add E2E tests with Playwright
- [ ] Implement form validation
- [ ] Add error boundaries for graceful error handling

## Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

## Status

**Implementation Status**: ✅ Story 1.5 Complete - Frontend Application Foundation Implemented
