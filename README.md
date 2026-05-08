# Polygon Annotator

A lightweight, web-based polygon annotation tool for annotating and refining object boundaries in computer vision datasets. Build polygons with any number of vertices (4+) on any image.

**Perfect for:**
- Annotating objects with bounding boxes (4 vertices) or custom polygons
- Creating ground-truth datasets for computer vision training
- Refining automatic segmentation predictions
- Interactive boundary calibration

## Features

✨ **Core Annotation**
- Create N-sided polygons (4+ vertices) directly on images
- Drag vertices to adjust boundaries with real-time feedback
- Manual coordinate input for precise placement
- Real-time magnifier for pixel-perfect edge placement

🎨 **UI/UX**
- Lightweight React + Konva canvas-based rendering
- Smooth zoom + pan with keyboard shortcuts
- Multi-image gallery with search and pagination
- Modern indigo/cyan color theme with dark mode support

📦 **Data & Export**
- Local file upload (100% offline, no server required)
- JSON export/import of annotations
- Generic `vertex_0`, `vertex_1`, etc. naming convention
- No database or backend dependencies

🔧 **Flexibility**
- Works with **any N-sided polygon** (4, 5, 6, ... vertices)
- Configurable vertex count per image
- Smart vertex seeding (axis-aligned for N=4, ellipse for N>4)
- Per-image editing with status tracking

## Quick Start

### Standalone (No Backend Required)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173, upload an image, and start annotating.

## Usage

1. **Upload Image** — Click the Upload button in the Image Gallery
2. **Set Vertices** — Choose number of vertices (default: 4 for bounding box)
3. **Place Points** — Vertices auto-seed; drag to adjust or enter coordinates manually
4. **Save** — Download annotations as JSON with vertex coordinates
5. **Export** — JSON format: `{ vertex_0: {x, y}, vertex_1: {x, y}, ... }`

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `H` | Home |
| `A` | Studio |
| `+` / `-` | Zoom in/out |
| `0` | Reset zoom |
| `F` | Fit to screen |
| `M` | Toggle magnifier |
| `Space + Drag` | Pan image |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Konva, Lucide Icons |
| Styling | Modern CSS with indigo/cyan theme |
| Deployment | Docker or standalone npm |

## Annotation Format

Annotations are stored as JSON with generic vertex naming:

```json
{
  "vertex_0": { "x": 100, "y": 150 },
  "vertex_1": { "x": 450, "y": 160 },
  "vertex_2": { "x": 460, "y": 500 },
  "vertex_3": { "x": 110, "y": 490 }
}
```

Works for any N-sided polygon:
- **N=4**: Bounding box (axis-aligned rectangle)
- **N=5**: Pentagon
- **N=6+**: Any polygon shape

## Configuration

### Frontend Environment Variables

```bash
# Optional: backend API endpoint (for future backend integration)
VITE_API_BASE_URL=http://localhost:8000
```

By default, the app runs completely offline with no backend required.

## Project Structure

```
.
├── frontend/
│   ├── src/
│   │   ├── app.tsx           # Main annotation UI
│   │   ├── app.css           # Styles (modern theme)
│   │   └── vite-env.d.ts
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
└── README.md
```

## License

MIT

## Contributing

Contributions welcome! Please:
1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

## Roadmap

- [ ] Undo/redo history
- [ ] Keyboard shortcuts for polygon manipulation (rotate, scale, flip)
- [ ] Batch annotation export (COCO, Pascal VOC)
- [ ] Multi-polygon support per image
- [ ] Drawing presets and templates
- [ ] Annotation validation rules

## FAQ

**Q: Do I need a backend or database?**  
A: No! Polygon Annotator is completely standalone. Upload images locally, annotate, and export JSON. All processing happens in your browser.

**Q: Can I use this offline?**  
A: Yes! The entire app works offline. No internet or server required.

**Q: How is this different from CVAT?**  
A: CVAT is full-featured but heavyweight. Polygon Annotator is lightweight, fast, and designed specifically for quick polygon annotation. Perfect for building datasets quickly.

**Q: Can I change the number of vertices per image?**  
A: Yes! Each image can have its own vertex count (4+). Just adjust the "Vertices" slider in the panel and vertices will automatically re-seed.

**Q: What image formats are supported?**  
A: Any format your browser supports: JPG, PNG, GIF, WebP, etc.

## Support

- **Issues:** GitHub Issues
- **Discussions:** GitHub Discussions

---

Made with ❤️ for the computer vision community.
