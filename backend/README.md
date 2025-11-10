# Backend Service

Node.js API server built with Dora framework for Zero-to-Running.

## Overview

This directory contains the backend API service built with:
- Node.js 18+ LTS
- Dora framework for routing and middleware
- TypeScript for type safety
- PostgreSQL for data persistence
- Redis for caching and session management

## Port Configuration

- API server: `http://localhost:3001`
- Debug port: `9229` (for Node.js debugging)

## Structure

The backend service will be organized as follows:

```
backend/
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── nodemon.json          # Nodemon configuration for auto-reload
├── src/                  # Source code
│   ├── index.ts          # Application entry point
│   ├── config/           # Configuration management
│   ├── routes/           # API route definitions
│   ├── controllers/      # Request handlers
│   ├── models/           # Data models
│   ├── middleware/       # Express/Dora middleware
│   ├── services/         # Business logic services
│   ├── utils/            # Utility functions
│   └── types/            # TypeScript type definitions
├── tests/                # Test files
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── fixtures/         # Test data and fixtures
└── dist/                 # Compiled JavaScript (gitignored)
```

## API Endpoints

The backend will provide RESTful API endpoints including:

- `GET /api/health` - Health check endpoint
- `GET /api/status` - Service status and version info
- Additional endpoints will be defined in later stories

## Database Integration

The backend connects to PostgreSQL for persistent data storage:
- Connection pooling for performance
- Migrations for schema management
- Query builders for type-safe database access

## Caching Layer

Redis is used for:
- Session storage
- API response caching
- Rate limiting
- Temporary data storage

## Development

The backend will be containerized with Docker and orchestrated via Docker Compose. When fully implemented:

```bash
# Start backend (and all services)
make dev

# View backend logs
make logs

# Stop all services
make down

# Run tests
npm test
```

## Environment Variables

The backend requires the following environment variables (see `.env.example`):

- `NODE_ENV` - Environment mode (development/production)
- `PORT` - API server port (default: 3001)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- Additional variables documented in `.env.example`

## Status

**Implementation Status**: Awaiting Story 1.4 (Backend Service Implementation)

This directory structure will be populated during the backend service story.
