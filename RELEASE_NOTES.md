# Release Notes — v1.0.0

**Polygon Annotator** — Open-source lightweight polygon annotation tool for computer vision.

A modern, generic, and flexible tool for creating and refining polygon annotations on any image.

## Features

### Core Annotation
- ✨ Create N-sided polygons (4+ vertices) on any image
- 🎨 Drag vertices directly on canvas for intuitive editing
- 🔍 Real-time magnifier for precise edge placement
- 📍 Manual coordinate input for exact positioning

### UI/UX
- ⚡ Lightweight React + Konva (canvas-based, not SVG)
- 🎛️ Smooth zoom + pan with keyboard shortcuts
- 🖼️ Multi-image gallery with search and pagination
- 🌓 Modern indigo/cyan theme with dark mode
- 📤 Local file upload (100% offline, no server required)

### Data Management
- 💾 JSON export with generic vertex naming
- 🎯 Per-image vertex count configuration
- 🔄 Smart vertex seeding (axis-aligned for N=4, ellipse for N>4)
- 📊 Real-time status tracking per image

## What's Included

```
polygon-annotator/
├── frontend/                  # React + Konva UI (standalone)
├── backend/                   # FastAPI (optional)
├── README.md                  # Full documentation
├── LICENSE (MIT)              # MIT License
└── docker-compose.yml         # Optional deployment
```

## Key Features in v1.0.0

### Core
- ✅ Generic N-sided polygon annotation (4+ vertices)
- ✅ Per-image vertex count configuration
- ✅ Smart vertex seeding and positioning
- ✅ Real-time magnifier for precision
- ✅ Full keyboard shortcut support

### User Experience
- ✅ Modern indigo/cyan color theme
- ✅ Dark mode support
- ✅ Image gallery with search
- ✅ Responsive canvas with zoom/pan
- ✅ Status tracking and image organization

### Data
- ✅ JSON export/import
- ✅ Generic vertex naming (vertex_0, vertex_1, etc.)
- ✅ 100% offline operation
- ✅ No database required for basic use

### Flexibility
- ✅ Works with any image format (JPG, PNG, GIF, WebP, etc.)
- ✅ Bounding box (4 vertices) or custom polygons
- ✅ Per-image settings
- ✅ Standalone or with optional backend

## Known Limitations

- Single polygon per image (multi-polygon on roadmap)
- No built-in version control or annotation history
- No collaborative features (comments, suggestions)
- Backend optional only (standalone mode has no persistence)
- Limited batch export formats (JSON only, COCO/VOC on roadmap)

## Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## System Requirements

### Standalone (Frontend Only)
- Node.js 18+
- Modern browser
- 100MB disk space

### Full Stack
- Node.js 18+
- Python 3.10+
- MongoDB 5.0+
- 500MB disk space

## Installation

### Fastest (Standalone)
```bash
cd frontend && npm install && npm run dev
# Open http://localhost:5173
```

### Full Stack
```bash
docker-compose up
# Open http://localhost:5173
```

See [QUICKSTART.md](QUICKSTART.md) for detailed instructions.

## Roadmap

**Q2 2025:**
- [ ] Undo/redo history
- [ ] Keyboard shortcuts for polygon manipulation
- [ ] COCO format export

**Q3 2025:**
- [ ] Multi-polygon support
- [ ] Mask/instance segmentation import
- [ ] Batch annotation export

**Q4 2025:**
- [ ] Plugin system for custom validators
- [ ] Annotation versioning
- [ ] Advanced filtering and search

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — Use freely in commercial and personal projects.

## Credits

Built with:
- React + TypeScript
- Konva canvas library
- FastAPI + Motor
- MongoDB
- Lucide icons

## Community

- 🐛 **Bug reports**: GitHub Issues
- 💡 **Feature requests**: GitHub Discussions
- 🤝 **Contributing**: See CONTRIBUTING.md

## FAQ

**Q: Why not just use CVAT?**  
A: CVAT is full-featured but heavyweight. Polygon Annotator is lightweight (no heavy dependencies), works offline, and requires no server setup for basic use.

**Q: Can I import predictions from my model?**  
A: Yes. The "reference" layer accepts JSON with vertex coordinates in the same format as annotations.

**Q: Can I use this for production?**  
A: Yes! Deploy with MongoDB backend for persistent storage and multi-user support. See DEPLOYMENT.md.

**Q: Is there a Python API?**  
A: The backend exposes a RESTful API. A Python SDK is on the roadmap.

## Acknowledgments

Built with care for the computer vision community.

---

**Ready to get started?** Head to [QUICKSTART.md](QUICKSTART.md).
