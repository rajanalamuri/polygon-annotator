"""
Minimal test suite for Polygon Annotator backend.
Tests core functionality: annotations, locks, and health checks.
"""

import pytest
from fastapi.testclient import TestClient
from mongomock import MongoClient
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app, init_db, close_db, db
import main as main_module


@pytest.fixture
def mock_db(monkeypatch):
    """Mock MongoDB with mongomock for testing."""
    # Use mongomock instead of real MongoDB
    mock_client = MongoClient()
    monkeypatch.setattr(main_module, 'client', mock_client)
    monkeypatch.setattr(main_module, 'db', mock_client['polygon_annotator_test'])

    yield mock_client['polygon_annotator_test']

    # Cleanup
    mock_client.drop_database('polygon_annotator_test')


@pytest.fixture
def client(mock_db):
    """FastAPI test client."""
    return TestClient(app)


class TestHealth:
    """Health check endpoint tests."""

    def test_health_check_success(self, client, mock_db):
        """Health check should return ok when database is connected."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        assert response.json()["database"] == "connected"


class TestAnnotations:
    """Annotation CRUD endpoint tests."""

    def test_save_annotation(self, client, mock_db):
        """Save annotation should create new record."""
        payload = {
            "image_id": "test-img-1",
            "image_name": "test.jpg",
            "ground_truth": {
                "vertex_0": {"x": 100, "y": 150},
                "vertex_1": {"x": 450, "y": 160},
                "vertex_2": {"x": 460, "y": 500},
                "vertex_3": {"x": 110, "y": 490}
            },
            "assigned_user": "alice"
        }

        response = client.post("/api/calibrate", json=payload)
        assert response.status_code == 200
        assert response.json()["status"] == "saved"
        assert response.json()["image_id"] == "test-img-1"

    def test_get_annotation(self, client, mock_db):
        """Get annotation should return saved record."""
        # First save an annotation
        payload = {
            "image_id": "test-img-2",
            "image_name": "test2.jpg",
            "ground_truth": {
                "vertex_0": {"x": 100, "y": 150},
                "vertex_1": {"x": 450, "y": 160},
                "vertex_2": {"x": 460, "y": 500},
                "vertex_3": {"x": 110, "y": 490}
            },
            "assigned_user": "bob"
        }
        client.post("/api/calibrate", json=payload)

        # Now fetch it
        response = client.get("/api/annotations/test-img-2")
        assert response.status_code == 200
        data = response.json()
        assert data["image_id"] == "test-img-2"
        assert data["assigned_user"] == "bob"
        assert len(data["ground_truth"]) == 4

    def test_get_annotation_not_found(self, client, mock_db):
        """Get non-existent annotation should return 404."""
        response = client.get("/api/annotations/nonexistent")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_list_annotations(self, client, mock_db):
        """List annotations should return paginated results."""
        # Save multiple annotations
        for i in range(3):
            payload = {
                "image_id": f"test-img-{i}",
                "image_name": f"test{i}.jpg",
                "ground_truth": {
                    "vertex_0": {"x": 100, "y": 150},
                    "vertex_1": {"x": 450, "y": 160},
                    "vertex_2": {"x": 460, "y": 500},
                    "vertex_3": {"x": 110, "y": 490}
                },
                "assigned_user": "alice"
            }
            client.post("/api/calibrate", json=payload)

        # List them
        response = client.get("/api/annotations?skip=0&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3
        assert len(data["annotations"]) == 3

    def test_delete_annotation(self, client, mock_db):
        """Delete annotation should remove record."""
        # Save an annotation
        payload = {
            "image_id": "test-delete",
            "image_name": "delete.jpg",
            "ground_truth": {
                "vertex_0": {"x": 100, "y": 150},
                "vertex_1": {"x": 450, "y": 160},
                "vertex_2": {"x": 460, "y": 500},
                "vertex_3": {"x": 110, "y": 490}
            },
            "assigned_user": "charlie"
        }
        client.post("/api/calibrate", json=payload)

        # Delete it
        response = client.delete("/api/annotations/test-delete")
        assert response.status_code == 200
        assert response.json()["status"] == "deleted"

        # Verify it's gone
        response = client.get("/api/annotations/test-delete")
        assert response.status_code == 404

    def test_delete_annotation_not_found(self, client, mock_db):
        """Delete non-existent annotation should return 404."""
        response = client.delete("/api/annotations/nonexistent")
        assert response.status_code == 404


class TestLocks:
    """Lock management endpoint tests."""

    def test_acquire_lock(self, client, mock_db):
        """Acquire lock should create lock entry."""
        payload = {"user": "alice"}
        response = client.post("/api/lock/img-1", json=payload)
        assert response.status_code == 200
        assert response.json()["status"] == "locked"
        assert response.json()["user"] == "alice"

    def test_lock_conflict(self, client, mock_db):
        """Acquiring lock for already-locked image should fail."""
        # Acquire lock as alice
        client.post("/api/lock/img-1", json={"user": "alice"})

        # Try to acquire as bob
        response = client.post("/api/lock/img-1", json={"user": "bob"})
        assert response.status_code == 409
        assert "locked" in response.json()["detail"].lower()

    def test_release_lock(self, client, mock_db):
        """Release lock should remove lock entry."""
        # Acquire lock
        client.post("/api/lock/img-1", json={"user": "alice"})

        # Release it
        response = client.post("/api/unlock/img-1", json={"user": "alice"})
        assert response.status_code == 200
        assert response.json()["status"] == "unlocked"

        # Now bob should be able to lock it
        response = client.post("/api/lock/img-1", json={"user": "bob"})
        assert response.status_code == 200

    def test_release_lock_wrong_user(self, client, mock_db):
        """Releasing lock owned by another user should fail."""
        # Acquire lock as alice
        client.post("/api/lock/img-1", json={"user": "alice"})

        # Try to release as bob
        response = client.post("/api/unlock/img-1", json={"user": "bob"})
        assert response.status_code == 404

    def test_release_nonexistent_lock(self, client, mock_db):
        """Releasing non-existent lock should return 404."""
        response = client.post("/api/unlock/nonexistent", json={"user": "alice"})
        assert response.status_code == 404


class TestModels:
    """Test Pydantic models."""

    def test_point_model(self):
        """Point model should validate coordinates."""
        from main import Point

        point = Point(x=100.5, y=200.5)
        assert point.x == 100.5
        assert point.y == 200.5

    def test_annotation_request_model(self):
        """AnnotationRequest model should validate structure."""
        from main import AnnotationRequest, Point

        request = AnnotationRequest(
            image_id="test",
            image_name="test.jpg",
            ground_truth={
                "vertex_0": Point(x=100, y=150),
                "vertex_1": Point(x=450, y=160)
            },
            assigned_user="alice"
        )
        assert request.image_id == "test"
        assert len(request.ground_truth) == 2
