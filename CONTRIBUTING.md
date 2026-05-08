# Contributing to Polygon Annotator

Thanks for your interest in contributing! We welcome contributions of all kinds.

## Code of Conduct

This project adheres to the Contributor Covenant [code of conduct](https://www.contributor-covenant.org/version/2_0/code_of_conduct/). By participating, you are expected to uphold this code.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/YOUR_USERNAME/polygon-annotator.git`
3. **Create a branch**: `git checkout -b feature/my-feature`
4. **Make changes** and test them locally
5. **Commit** with clear messages: `git commit -am 'Add my feature'`
6. **Push** to your fork: `git push origin feature/my-feature`
7. **Open a Pull Request** with a description of your changes

## Development Setup

### Local Development Environment

```bash
# Clone repo
git clone https://github.com/yourusername/polygon-annotator.git
cd polygon-annotator

# Frontend development
cd frontend
npm install
npm run dev

# Backend development (in a separate terminal)
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
MONGODB_URI=mongodb://localhost:27017 python main.py
```

### Running Tests

```bash
# Frontend tests
cd frontend
npm test

# Backend tests
cd backend
python -m pytest tests/ -v
```

### Code Style

- **Frontend**: ESLint + Prettier (configure in `frontend/`)
- **Backend**: Black + isort (configure in `backend/`)

```bash
# Format backend code
black backend/
isort backend/

# Format frontend code
cd frontend && npm run format
```

## What to Contribute

### High Priority
- [ ] Support for mask/instance segmentation import
- [ ] Keyboard shortcuts for polygon manipulation (rotate, scale, flip)
- [ ] Batch annotation export (COCO, Pascal VOC formats)
- [ ] Undo/redo history
- [ ] Multi-polygon support per image

### Medium Priority
- [ ] Unit test coverage for backend
- [ ] Integration tests for API
- [ ] Performance improvements (large images)
- [ ] Dark mode refinements
- [ ] Documentation improvements

### Lower Priority
- [ ] Plugin system for custom validators
- [ ] Advanced filtering and search
- [ ] Annotation versioning
- [ ] Collaboration features (comments, suggestions)

## Bug Reports

When reporting a bug, please include:

1. **Reproduction steps** — How to reproduce the issue
2. **Expected behavior** — What should happen
3. **Actual behavior** — What does happen
4. **Screenshots** (if applicable)
5. **Environment** — OS, browser, Python version, etc.

Example:

```
Title: "Upload button not working on Firefox"

Steps to reproduce:
1. Open http://localhost:5173 in Firefox 121
2. Click "Upload Image" button
3. Select a PNG file

Expected: File dialog opens
Actual: Nothing happens

Error log: [Paste console errors here]

Environment:
- Firefox 121.0
- macOS Sonoma
- polygon-annotator latest main branch
```

## Feature Requests

Describe:
1. **What problem does this solve?**
2. **How would users interact with it?**
3. **Example use case**

Example:

```
Title: "Add keyboard shortcut to delete last vertex"

Problem: Using backspace or delete in many tools deletes the last placed element.
Polygon annotators expect this behavior.

Proposed behavior:
- User presses `Backspace` while annotating
- Last vertex is removed
- If only 2 vertices remain, show a warning

Use case: Fast annotation of imprecise reference predictions requires rapid
vertex removal. Currently users must drag vertices outside bounds.
```

## Pull Request Process

1. **Update tests** — Add tests for new functionality
2. **Update docs** — Update README.md, QUICKSTART.md as needed
3. **Follow code style** — Run formatter before committing
4. **Clear commit messages** — Use imperative mood ("Add", "Fix", "Update")
5. **Link issues** — Reference related issues in PR description

Example PR:

```
Title: Add undo/redo keyboard shortcuts

Closes #42

## Changes
- Add Ctrl+Z / Ctrl+Y for undo/redo
- Store operation history in state
- Clear history on image change

## Testing
- [x] Tested with 100+ vertex operations
- [x] Verified memory usage stays under 50MB
- [x] Works across image switches

## Screenshots
[Before] [After]
```

## Documentation

### Code Comments
- Add comments for complex geometry calculations
- Document public API functions
- Explain "why" not "what" — code shows what it does

### README Updates
- Update table of contents if adding sections
- Include examples for new features
- Test documentation locally before PR

### Docstrings
```python
def compute_inset_polygon(points: list[Point], inset: float) -> list[Point]:
    """
    Compute an inset (eroded) polygon from a set of vertices.
    
    Args:
        points: List of (x, y) tuples in counterclockwise order
        inset: Inset distance in pixels (positive = shrink inward)
    
    Returns:
        List of new vertices representing the inset polygon
    
    Raises:
        ValueError: If fewer than 3 points provided
    """
```

## Review Process

All submissions require review. We will:

1. **Check code quality** — linting, type hints, tests
2. **Verify functionality** — does it work as described?
3. **Assess design** — does it fit the project goals?
4. **Request changes** if needed — we're collaborative, not adversarial

Expect 1-2 week turnaround for reviews.

## Project Goals

Polygon Annotator aims to be:

✅ **Lightweight** — No heavy dependencies, works offline
✅ **Fast** — Real-time annotation on modern hardware
✅ **Simple** — Focused on polygon annotation, not everything
✅ **Hackable** — Easy to customize and extend
✅ **Open** — MIT licensed, community-driven

We decline features that:
- Add significant dependencies
- Bloat the UI
- Diverge from polygon annotation focus

## Community

- **Issues**: Use GitHub Issues for bugs and features
- **Discussions**: Use GitHub Discussions for questions
- **Email**: [project email if applicable]

## License

By contributing, you agree your code will be licensed under the MIT License.

---

Thank you for contributing! 🎉
