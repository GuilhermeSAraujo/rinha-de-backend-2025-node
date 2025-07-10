# Docker Setup - Rinha de Backend 2025

This document describes how to run the Node.js API using Docker Compose with nginx load balancer, multiple backend instances, and MongoDB.

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │───▶│    Nginx    │───▶│  Backend-01 │
│             │    │ Load Balancer│    │             │
└─────────────┘    └─────────────┘    └─────────────┘
                          │                   │
                          ▼                   ▼
                   ┌─────────────┐    ┌─────────────┐
                   │  Backend-02 │    │   MongoDB   │
                   │             │    │             │
                   └─────────────┘    └─────────────┘
```

## Services

- **nginx**: Load balancer (port 9999)
- **backend-01**: Node.js API instance 1
- **backend-02**: Node.js API instance 2
- **mongodb**: MongoDB database (port 27017)

## Quick Start

1. **Build and start all services:**
   ```bash
   docker-compose up --build
   ```

2. **Start in detached mode:**
   ```bash
   docker-compose up -d --build
   ```

3. **Stop all services:**
   ```bash
   docker-compose down
   ```

4. **Stop and remove volumes:**
   ```bash
   docker-compose down -v
   ```

## Access Points

- **API (via nginx)**: http://localhost:9999
- **Health Check**: http://localhost:9999/health
- **MongoDB**: localhost:27017
- **Backend-01 (direct)**: http://localhost:3001 (if exposed)
- **Backend-02 (direct)**: http://localhost:3002 (if exposed)

## Environment Variables

### Backend Services
- `NODE_ENV`: production
- `PORT`: 3000
- `MONGODB_URI`: mongodb://admin:password123@mongodb:27017/rinha?authSource=admin
- `INSTANCE_ID`: 01 or 02

### MongoDB
- `MONGO_INITDB_ROOT_USERNAME`: admin
- `MONGO_INITDB_ROOT_PASSWORD`: password123
- `MONGO_INITDB_DATABASE`: rinha

## API Endpoints

- `GET /` - API information
- `GET /health` - Health check (includes instance ID)
- `GET /db-status` - MongoDB connection status

## Load Balancing

Nginx distributes requests between the two backend instances using round-robin load balancing.

### Health Check Response Example
```json
{
  "status": "OK",
  "timestamp": "2025-01-27T10:30:00.000Z",
  "uptime": 123.456,
  "instance": "01",
  "environment": "production"
}
```

## Monitoring

### Check service status:
```bash
docker-compose ps
```

### View logs:
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs backend-01
docker-compose logs nginx
docker-compose logs mongodb
```

### Follow logs in real-time:
```bash
docker-compose logs -f
```

## Resource Limits

- **Backend instances**: 0.5 CPU, 512MB RAM
- **MongoDB**: 1.0 CPU, 1GB RAM
- **Nginx**: 0.25 CPU, 64MB RAM

## Development

### Rebuild a specific service:
```bash
docker-compose build backend-01
docker-compose up -d backend-01
```

### Access MongoDB shell:
```bash
docker-compose exec mongodb mongosh -u admin -p password123
```

### Access backend container:
```bash
docker-compose exec backend-01 sh
```

## Troubleshooting

### Check if services are healthy:
```bash
docker-compose ps
```

### View detailed logs:
```bash
docker-compose logs --tail=100 backend-01
```

### Restart a service:
```bash
docker-compose restart backend-01
```

### Clean up everything:
```bash
docker-compose down -v --remove-orphans
docker system prune -f
```

## Production Considerations

1. **Environment Variables**: Use `.env` file or Docker secrets for sensitive data
2. **Volumes**: MongoDB data is persisted in a named volume
3. **Networks**: All services communicate through a dedicated bridge network
4. **Health Checks**: All services include health check endpoints
5. **Resource Limits**: Configured to prevent resource exhaustion

## Security

- MongoDB requires authentication
- Backend services run as non-root user
- Nginx includes security headers via Helmet
- CORS is enabled for cross-origin requests 