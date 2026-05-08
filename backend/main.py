"""
Polygon Annotator Backend — FastAPI server for annotation persistence (optional).
For standalone use, frontend works without backend. With backend, annotations persist to MongoDB.
"""

import os
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
from pydantic import BaseModel

# Models
class Point(BaseModel):
    x: float
    y: float

class AnnotationRequest(BaseModel):
    image_id: str
    image_name: str
    ground_truth: dict[str, Point]
    assigned_user: str

class LockRequest(BaseModel):
    user: str

# Database setup
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "polygon_annotator")
ANNOTATIONS_COLLECTION = "annotations"
LOCKS_COLLECTION = "locks"

client: Optional[MongoClient] = None
db = None

def init_db():
    global client, db
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    db = client[DATABASE_NAME]
    try:
        client.admin.command("ping")
        print(f"Connected to MongoDB: {MONGODB_URI}")
        # Create indexes
        db[ANNOTATIONS_COLLECTION].create_index("image_id", unique=True)
        db[LOCKS_COLLECTION].create_index("image_id", unique=True)
    except ConnectionFailure as e:
        print(f"MongoDB connection failed: {e}")
        raise

def close_db():
    global client
    if client:
        client.close()
        print("MongoDB connection closed")

# Initialize app
app = FastAPI(title="Polygon Annotator", version="1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup/shutdown
@app.on_event("startup")
def startup():
    init_db()

@app.on_event("shutdown")
def shutdown():
    close_db()

# Health check
@app.get("/health")
def health():
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")
    return {"status": "ok", "database": "connected"}

# Lock management
@app.post("/api/lock/{image_id}")
def acquire_lock(image_id: str, request: LockRequest):
    """Acquire an exclusive edit lock for an image."""
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    locks = db[LOCKS_COLLECTION]
    existing = locks.find_one({"image_id": image_id})

    if existing and existing.get("user") != request.user:
        raise HTTPException(
            status_code=409,
            detail=f"Image locked by {existing.get('user')}"
        )

    locks.update_one(
        {"image_id": image_id},
        {
            "$set": {
                "user": request.user,
                "acquired_at": datetime.utcnow().isoformat()
            }
        },
        upsert=True
    )
    return {"status": "locked", "user": request.user}

@app.post("/api/unlock/{image_id}")
def release_lock(image_id: str, request: LockRequest):
    """Release an edit lock."""
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    locks = db[LOCKS_COLLECTION]
    result = locks.delete_one({"image_id": image_id, "user": request.user})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lock not found or owned by another user")

    return {"status": "unlocked"}

# Annotation endpoints
@app.get("/api/annotations/{image_id}")
def get_annotation(image_id: str):
    """Fetch annotation for a specific image."""
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    doc = db[ANNOTATIONS_COLLECTION].find_one({"image_id": image_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Annotation not found")

    doc.pop("_id", None)
    return doc

@app.post("/api/calibrate")
def save_annotation(request: AnnotationRequest):
    """Save an annotation to the database."""
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    data = {
        "image_id": request.image_id,
        "image_name": request.image_name,
        "ground_truth": {k: v.dict() if hasattr(v, 'dict') else v for k, v in request.ground_truth.items()},
        "assigned_user": request.assigned_user,
        "status": "completed",
        "updated_at": datetime.utcnow().isoformat()
    }

    result = db[ANNOTATIONS_COLLECTION].update_one(
        {"image_id": request.image_id},
        {"$set": data},
        upsert=True
    )

    return {
        "status": "saved",
        "image_id": request.image_id,
        "matched_count": result.matched_count,
        "upserted_id": str(result.upserted_id) if result.upserted_id else None
    }

@app.get("/api/annotations")
def list_annotations(skip: int = 0, limit: int = 50):
    """List all annotations with pagination."""
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    docs = list(db[ANNOTATIONS_COLLECTION].find().skip(skip).limit(limit))
    total = db[ANNOTATIONS_COLLECTION].count_documents({})

    for doc in docs:
        doc.pop("_id", None)

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "annotations": docs
    }

@app.delete("/api/annotations/{image_id}")
def delete_annotation(image_id: str):
    """Delete an annotation."""
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    result = db[ANNOTATIONS_COLLECTION].delete_one({"image_id": image_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Annotation not found")

    return {"status": "deleted", "image_id": image_id}

# Debug
@app.get("/api/debug/db")
def debug_db():
    """Health check and database info."""
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    try:
        stats = db.command("dbStats")
        return {
            "status": "ok",
            "database": DATABASE_NAME,
            "collections": stats.get("collections", 0),
            "data_size_mb": round(stats.get("dataSize", 0) / 1024 / 1024, 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
