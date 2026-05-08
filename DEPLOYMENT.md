# Deployment Guide

## Local Development

### Prerequisites
- Node.js 18+
- Python 3.10+
- MongoDB 5.0+ (or Docker)

### Standalone Frontend (No Backend)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. You can upload images and annotate locally. Annotations are saved only in browser memory.

### Full Stack with Docker Compose

```bash
docker-compose up --build
```

This starts:
- MongoDB on `localhost:27017`
- Backend on `localhost:8000`
- Frontend on `localhost:5173`

### Full Stack Manual Setup

#### 1. Start MongoDB

```bash
# Using Docker
docker run -d -p 27017:27017 mongo:7.0

# Or local MongoDB
mongod
```

#### 2. Start Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
MONGODB_URI=mongodb://localhost:27017 DATABASE_NAME=polygon_annotator python main.py
```

Backend runs on `http://localhost:8000`

#### 3. Start Frontend

```bash
cd frontend
npm install
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

Frontend runs on `http://localhost:5173`

## Production Deployment

### Docker

```bash
# Build backend
docker build -f backend.Dockerfile -t polygon-annotator-backend:latest .

# Build frontend
docker build -f frontend/Dockerfile -t polygon-annotator-frontend:latest ./frontend

# Run with Docker Compose (with prod settings)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Kubernetes

See `k8s/` directory for example manifests.

### Environment Variables

#### Backend

- `MONGODB_URI` — MongoDB connection string (default: `mongodb://localhost:27017`)
- `DATABASE_NAME` — Database name (default: `polygon_annotator`)
- `CORS_ORIGINS` — Comma-separated CORS origins (default: `*`)

#### Frontend

- `VITE_API_BASE_URL` — Backend API URL (default: `http://localhost:8000`)

## Database Setup

### MongoDB Collections

Collections are created automatically on first write:

```javascript
db.annotations.createIndex({ "image_id": 1 }, { unique: true })
db.locks.createIndex({ "image_id": 1 }, { unique: true })
db.locks.createIndex({ "acquired_at": 1 }, { expireAfterSeconds: 3600 })
```

To initialize manually:

```bash
mongosh
use polygon_annotator
db.annotations.createIndex({ "image_id": 1 }, { unique: true })
db.locks.createIndex({ "image_id": 1 }, { unique: true })
db.locks.createIndex({ "acquired_at": 1 }, { expireAfterSeconds: 3600 })
```

## Health Checks

**Backend:**
```bash
curl http://localhost:8000/health
# {"status": "ok", "database": "connected"}
```

**Database:**
```bash
curl http://localhost:8000/api/debug/db
# {"status": "ok", "database": "polygon_annotator", "collections": 2, "data_size_mb": 0.05}
```

## Scaling

### Multi-instance Backend

Use a load balancer (nginx, ALB, etc.) in front of multiple backend instances. All instances should point to the same MongoDB.

### Database Replication

For production, use MongoDB Atlas or a replica set:

```bash
# Local replica set (3 nodes)
docker run -d --name mongo1 -p 27017:27017 mongo:7.0 mongod --replSet rs0
docker run -d --name mongo2 -p 27018:27017 mongo:7.0 mongod --replSet rs0
docker run -d --name mongo3 -p 27019:27017 mongo:7.0 mongod --replSet rs0

# Initialize
mongosh --host localhost:27017
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "localhost:27017" },
    { _id: 1, host: "localhost:27018" },
    { _id: 2, host: "localhost:27019" }
  ]
})
```

## Monitoring

### Logs

```bash
# Docker
docker-compose logs -f backend
docker-compose logs -f frontend

# Local
# Backend logs to stdout
# Frontend: browser console
```

### Metrics (Optional)

Backend can be extended with Prometheus metrics. See `backend/prometheus.py` for example.

## Troubleshooting

### "Database not connected"

```bash
# Check MongoDB is running
curl http://localhost:27017/

# Check backend can reach MongoDB
docker-compose logs mongodb
```

### CORS errors in browser

Check `CORS_ORIGINS` environment variable matches your frontend origin.

### Annotations not persisting

1. Verify MongoDB is running: `mongosh`
2. Check backend logs: `docker-compose logs backend`
3. Verify user has edit lock: `POST /api/lock/{image_id}`

## Backup & Restore

### MongoDB Backup

```bash
mongodump --uri="mongodb://localhost:27017/polygon_annotator" --out=./backup
```

### MongoDB Restore

```bash
mongorestore --uri="mongodb://localhost:27017/polygon_annotator" ./backup
```

## Support

- Issues: GitHub Issues
- Docs: README.md
- API: Backend auto-generates OpenAPI docs at `/docs`
