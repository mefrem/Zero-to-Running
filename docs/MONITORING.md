# Zero-to-Running Monitoring Dashboard

**Story 2.5: Developer Monitoring Dashboard**
**Epic 2: Service Health & Observability**

## Overview

The Zero-to-Running monitoring dashboard provides developers with comprehensive visibility into the health and status of all services in the development environment. The monitoring system includes both CLI and web-based interfaces for checking service health, resource usage, and system status.

## Features

### CLI Status Command

- **Command**: `make status`
- **Purpose**: Display service status, uptime, resource usage, and port mappings
- **Refresh**: Manual (run command to get latest status)
- **Output**: ASCII table with color-coded status indicators

### Web Dashboard

- **URL**: `http://localhost:3000/#dashboard`
- **Purpose**: Real-time health monitoring with visual indicators
- **Auto-refresh**: Every 10 seconds
- **Features**:
  - Service health cards for Frontend, Backend, Database, and Redis
  - Response time metrics
  - Last check timestamp
  - Manual refresh button
  - Error state handling with troubleshooting tips

## Using the CLI Status Command

### Basic Usage

```bash
make status
```

### Example Output

```
Zero-to-Running Service Status

Service      Status       Uptime       CPU      Memory     Ports
--------     ------       ------       ---      ------     -----
frontend     Healthy      5m 32s       0.5%     125MB      3000
backend      Healthy      5m 35s       1.2%     180MB      3001
postgres     Healthy      5m 40s       0.8%     95MB       5432
redis        Healthy      5m 41s       0.3%     42MB       6379

✓ All services are healthy

Tips:
  - Use 'make logs' to view service logs
  - Use 'make logs service=<name>' to view specific service logs
  - Use 'make dev' to start/restart services
  - Use 'make down' to stop all services
```

### Status Indicators

| Status | Color | Meaning |
|--------|-------|---------|
| **Healthy** | Green | Service is running and health check passing |
| **Running** | Blue | Service is running but no health check configured |
| **Unhealthy** | Red | Service is running but health check failing |
| **Stopped** | Yellow | Service is not running |

### When Services Are Unhealthy

If any service shows as unhealthy or stopped, the status command will display:

```
⚠ Some services are unhealthy or stopped.
Run 'make logs' to view logs and troubleshoot.
```

### Disabling Color Output

To disable color output (useful for CI/CD or scripting):

```bash
NO_COLOR=1 make status
```

## Using the Web Dashboard

### Accessing the Dashboard

1. Start the development environment:
   ```bash
   make dev
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

3. Click **"View Full Monitoring Dashboard"** button on the landing page

   OR

   Navigate directly to:
   ```
   http://localhost:3000/#dashboard
   ```

### Dashboard Features

#### Overall Status Banner

Shows the overall health of the system:
- **All Systems Healthy** (Green) - All services are operational
- **Some Systems Degraded** (Yellow) - One or more services are unhealthy
- **Checking...** (Gray) - Initial health check in progress

#### Service Health Cards

Each service has a dedicated card showing:
- **Service Name**: Frontend, Backend, Database, or Redis
- **Status Indicator**: Visual icon (✓ for healthy, ✗ for unhealthy, ⟳ for checking)
- **Status Badge**: Color-coded status text
- **Error Details**: If unhealthy, shows error message

#### Metrics Section

Displays key monitoring metrics:
- **Response Time**: Backend API response time in milliseconds
- **Auto-Refresh Interval**: Shows 10-second refresh interval
- **Last Update**: Timestamp of the most recent health check

#### Manual Refresh

Click the **"Refresh Now"** button to force an immediate health check without waiting for the auto-refresh interval.

#### Troubleshooting Tips

The dashboard includes a help section with common commands:
- `make status` - View CLI service status
- `make logs` - View all service logs
- `make logs service=backend` - View specific service logs
- `make dev` - Start/restart services

### Auto-Refresh Behavior

The dashboard automatically refreshes health data every **10 seconds** using a background polling mechanism:

- Health data is fetched from `/health/dashboard` endpoint
- The refresh happens in the background without page reload
- Last check timestamp updates with each refresh
- Response time is recalculated with each check

To customize the refresh interval, modify the `setInterval` value in `/frontend/src/components/Dashboard.tsx`.

## Backend Health Endpoint

### Endpoint: GET /health/dashboard

**URL**: `http://localhost:3001/health/dashboard`

**Purpose**: Provides comprehensive health information for the monitoring dashboard

**Response Format**:

```json
{
  "status": "ready",
  "services": {
    "backend": "ok",
    "database": "ok",
    "cache": "ok"
  },
  "timestamp": "2025-11-10T14:30:45.123Z",
  "responseTime": 45
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Overall system status: "ready" or "degraded" |
| `services` | object | Health status of each service dependency |
| `services.backend` | string | Backend API health: "ok" or "error" |
| `services.database` | string | PostgreSQL health: "ok" or "error" |
| `services.cache` | string | Redis health: "ok" or "error" |
| `timestamp` | string | ISO 8601 timestamp of the health check |
| `responseTime` | number | Response time in milliseconds |
| `errors` | object | (Optional) Error details if any service is unhealthy |

**HTTP Status Codes**:
- `200 OK` - Always returned (even with degraded services)

**Error Response Example**:

```json
{
  "status": "degraded",
  "services": {
    "backend": "ok",
    "database": "error",
    "cache": "ok"
  },
  "timestamp": "2025-11-10T14:30:45.123Z",
  "responseTime": 152,
  "errors": {
    "database": "Connection timeout"
  }
}
```

## Architecture

### CLI Status Command Flow

```
make status
  ↓
status.sh script
  ↓
Docker commands (ps, inspect, stats)
  ↓
Parse and format data
  ↓
Display ASCII table with status
```

### Web Dashboard Flow

```
Frontend Dashboard Component
  ↓
useEffect + setInterval (10 seconds)
  ↓
fetchDashboardHealth() API call
  ↓
GET /health/dashboard
  ↓
Backend checks database and Redis
  ↓
Returns JSON response
  ↓
Update component state
  ↓
Re-render with new health data
```

## Troubleshooting

### CLI Status Command Issues

**Problem**: `make status` shows "Docker daemon is not running"

**Solution**: Start Docker Desktop or Docker daemon:
```bash
# macOS
open -a Docker

# Linux
sudo systemctl start docker
```

---

**Problem**: `make status` shows "No services are running"

**Solution**: Start the development environment:
```bash
make dev
```

---

**Problem**: Services show as "Unhealthy"

**Solution**: Check service logs to identify the issue:
```bash
make logs service=<service-name>
```

Common causes:
- Database connection issues
- Redis connection issues
- Missing environment variables
- Port conflicts

### Web Dashboard Issues

**Problem**: Dashboard shows error "Failed to fetch health data"

**Solution**:
1. Verify backend is running: `make status`
2. Check backend logs: `make logs service=backend`
3. Verify API URL in `.env`: `VITE_API_URL=http://localhost:3001`
4. Restart services: `make dev`

---

**Problem**: Dashboard not updating automatically

**Solution**:
1. Check browser console for JavaScript errors (F12)
2. Verify network tab shows requests to `/health/dashboard` every 10 seconds
3. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)

---

**Problem**: Dashboard shows all services as "Checking..."

**Solution**:
1. Verify backend `/health/dashboard` endpoint is accessible:
   ```bash
   curl http://localhost:3001/health/dashboard
   ```
2. Check for CORS issues in browser console
3. Verify services are running: `make status`

---

**Problem**: Inaccurate response times

**Solution**:
- Response times include network latency and backend processing
- Response times > 1000ms may indicate:
  - Slow database queries
  - Network issues
  - High system load
- Check backend logs for slow queries: `make logs service=backend`

## Performance Considerations

### CLI Status Command

- Execution time: ~1-2 seconds (includes Docker stats collection)
- `docker stats` requires 1-second wait for accurate CPU/memory data
- Recommended usage: On-demand status checks

### Web Dashboard

- Polling interval: 10 seconds (configurable)
- Network overhead: ~1-2 KB per health check request
- Browser resources: Minimal (lightweight React component)
- Backend load: Negligible (simple health checks with 1-second timeout)

### Scaling Considerations

For larger deployments or production environments, consider:
- Increasing auto-refresh interval to reduce backend load
- Implementing health check caching on the backend
- Using WebSockets for real-time updates instead of polling
- Adding historical metrics and graphing

## Related Documentation

- [Health Check Implementation](./stories/2.1.backend-health-check-implementation.md) - Backend health endpoints
- [Database Health Verification](./stories/2.2.database-health-verification.md) - Database health checks
- [Startup Health Verification](./stories/2.3.startup-health-verification-automation.md) - Startup automation
- [Structured Logging](./stories/2.4.structured-logging-implementation.md) - Logging infrastructure
- [Logging Guide](./LOGGING.md) - Comprehensive logging documentation

## Testing

### Running Tests

**CLI Status Tests**:
```bash
bash infrastructure/scripts/__tests__/status.test.sh
```

**Frontend Dashboard Tests**:
```bash
cd frontend
npm test Dashboard.test.tsx
```

**Integration Tests**:
```bash
bash infrastructure/scripts/__tests__/monitoring-integration.test.sh
```

### Test Coverage

The monitoring system includes:
- Unit tests for CLI status script
- Component tests for Dashboard.tsx
- Integration tests for end-to-end monitoring functionality
- API endpoint tests for `/health/dashboard`

## Support

For issues or questions related to the monitoring dashboard:

1. Check this documentation
2. Review service logs: `make logs`
3. Check service status: `make status`
4. Review health check endpoints in the codebase
5. Consult the development team

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-10 | 1.0 | Initial monitoring dashboard implementation (Story 2.5) |
