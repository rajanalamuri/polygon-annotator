# Quick Start

## 30 seconds to your first annotation

### Option 1: Standalone (Fastest)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173, upload an image, and start annotating. Everything runs in your browser.

### Option 2: Full Stack with Docker

```bash
docker-compose up
```

Open http://localhost:5173. Backend stores annotations in MongoDB automatically.

---

## How to Annotate

1. **Upload Image**
   - Click "Upload Image" in the gallery toolbar
   - Select any image from your computer

2. **Add Vertices**
   - Click on the image canvas to place polygon points
   - Click to add more vertices (creates an N-sided polygon)
   - Drag vertices to adjust positions

3. **Fine-tune**
   - Use the magnifier (right panel) for precise edge placement
   - Adjust zoom with `+` / `-` or scroll
   - Pan with `Space + Drag`

4. **Compare**
   - Toggle "ABC Co-ordinates" to see reference predictions
   - Toggle "Ground Truth" to see your annotations
   - Use "Line Visibility" controls to compare layers

5. **Export**
   - Click "Download GT JSON" to save annotations locally
   - Or use the backend API for persistent storage

---

## Example Workflow

```bash
# Terminal 1: Start services
docker-compose up

# Terminal 2: (optional) Monitor backend
docker-compose logs -f backend

# Browser: http://localhost:5173
# - Upload image.jpg
# - Place 4-6 vertices on the image
# - Export JSON
# - Done!
```

---

## Next Steps

- **Read annotations programmatically:** See `DEPLOYMENT.md` for API endpoints
- **Customize UI:** Edit `frontend/src/app.tsx`
- **Deploy:** See `DEPLOYMENT.md` for Docker/Kubernetes setup
- **Contribute:** Open an issue or PR on GitHub

---

## Troubleshooting

**"Cannot connect to backend"**
- Is MongoDB running? `docker ps`
- Is backend running? `docker-compose logs backend`

**"Cannot upload image"**
- Check browser console for errors
- Ensure file is a valid image (PNG, JPG, etc.)

**"Annotations disappear after refresh"**
- Standalone mode only persists in browser session
- Use full stack (Option 2) for persistent storage

---

## Common Tasks

### Use your own predictions
1. Export ground truth as JSON from your model
2. Place predictions JSON in same format as annotations
3. Upload as "reference" layer in UI

### Batch process images
1. Write a script using the backend API:
   ```python
   import requests
   
   for image_id, annotations in my_annotations.items():
       requests.post(
           "http://localhost:8000/api/calibrate",
           json={
               "image_id": image_id,
               "image_name": f"{image_id}.jpg",
               "ground_truth": annotations,
               "assigned_user": "batch_script"
           }
       )
   ```

### Export all annotations
```bash
curl http://localhost:8000/api/annotations?limit=999 > annotations.json
```

---

Enjoy annotating! 🎉
