
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Circle } from 'react-konva';
import useImage from 'use-image';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Home, Lock, ScanSearch, Upload } from 'lucide-react';
import './app.css';



type Point = { x: number; y: number };
type ReferenceMap = Record<string, Point>;
type AnnotationPoint = { x: number | null; y: number | null };
type AnnotationMap = Record<string, AnnotationPoint>;
type QAStatus = 'not_yet' | 'in_progress' | 'completed' | 'no_action';
type CompletionMeta = { user: string; updatedAt: string };

type QAImage = {
  id: string;
  name: string;
  src: string;
  imageKey?: string;
  isObjectUrl: boolean;
};


const DEFAULT_VERTEX_COUNT = 4;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const DEFAULT_SCALE = 0.45;
const MIN_SCALE = 0.2;
const MAX_SCALE = 2;
const ZOOM_STEP = 0.1;
const BASE_IMAGE_WIDTH = 1920;
const BASE_IMAGE_HEIGHT = 1080;
const LENS_SIZE = 132;
const POLY_COLOR = '#4f46e5';
const THUMBNAILS_PER_PAGE = 50;

const getVertexKeys = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `vertex_${i}`);

const createEmptyAnnotation = (n: number): AnnotationMap =>
  Object.fromEntries(
    getVertexKeys(n).map((key) => [key, { x: null, y: null }])
  ) as AnnotationMap;

const seedVertices = (n: number): AnnotationMap => {
  if (n === 4) {
    const x1 = Math.round(BASE_IMAGE_WIDTH * 0.2);
    const y1 = Math.round(BASE_IMAGE_HEIGHT * 0.2);
    const x2 = Math.round(BASE_IMAGE_WIDTH * 0.8);
    const y2 = Math.round(BASE_IMAGE_HEIGHT * 0.8);
    return {
      vertex_0: { x: x1, y: y1 },
      vertex_1: { x: x2, y: y1 },
      vertex_2: { x: x2, y: y2 },
      vertex_3: { x: x1, y: y2 }
    };
  }

  const cx = BASE_IMAGE_WIDTH / 2;
  const cy = BASE_IMAGE_HEIGHT / 2;
  const rx = BASE_IMAGE_WIDTH * 0.35;
  const ry = BASE_IMAGE_HEIGHT * 0.35;

  return Object.fromEntries(
    Array.from({ length: n }, (_, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      return [
        `vertex_${i}`,
        {
          x: Math.round(cx + rx * Math.cos(angle)),
          y: Math.round(cy + ry * Math.sin(angle))
        }
      ];
    })
  ) as AnnotationMap;
};


export default function App() {
  const [page, setPage] = useState<'home' | 'studio'>('home');
  const [images, setImages] = useState<QAImage[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Record<string, AnnotationMap>>({});
  const [qaStatusByImage, setQaStatusByImage] = useState<Record<string, QAStatus>>({});
  const [completionMetaByImage, setCompletionMetaByImage] = useState<Record<string, CompletionMeta>>({});
  const [editUnlockedByImage, setEditUnlockedByImage] = useState<Record<string, boolean>>({});
  const [vertexCountByImage, setVertexCountByImage] = useState<Record<string, number>>({});
  const editUnlockedByImageRef = useRef<Record<string, boolean>>({});
  const [lockOwnerByImage, setLockOwnerByImage] = useState<Record<string, string | null>>({});
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [assignedUser, setAssignedUser] = useState('');
  const [isAssignedUserLocked, setIsAssignedUserLocked] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Upload an image to start annotating.');
  const [showAnnotation, setShowAnnotation] = useState(true);
  const [showMagnifier, setShowMagnifier] = useState(true);
  const [magnifierZoom, setMagnifierZoom] = useState(2.2);
  const [annotationLineWidth, setAnnotationLineWidth] = useState(3);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [mousePx, setMousePx] = useState<{ x: number; y: number } | null>(null);
  const [galleryPage, setGalleryPage] = useState(1);
  const [gallerySearchInput, setGallerySearchInput] = useState('');
  const [gallerySearch, setGallerySearch] = useState('');
  const gallerySearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const imageRefreshAttemptsRef = useRef<Record<string, number>>({});
  const refreshingImageIdsRef = useRef<Set<string>>(new Set());
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<any>(null);
  const panStartRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  const activeImage = useMemo(
    () => images.find((item) => item.id === activeImageId) ?? null,
    [images, activeImageId]
  );

  const [img, imgStatus] = useImage(activeImage?.src ?? '');
  const activeVertexCount = activeImage
    ? (vertexCountByImage[activeImage.id] ?? DEFAULT_VERTEX_COUNT)
    : DEFAULT_VERTEX_COUNT;
  const activeVertexKeys = getVertexKeys(activeVertexCount);
  const activeGroundTruth = activeImage
    ? (annotations[activeImage.id] ?? createEmptyAnnotation(activeVertexCount))
    : createEmptyAnnotation(DEFAULT_VERTEX_COUNT);
  const groundTruthPoints = activeVertexKeys
    .map((key) => activeGroundTruth[key])
    .filter((point): point is Point => point.x !== null && point.y !== null)
    .map((point) => ({ x: point.x, y: point.y }));
  const groundTruthScreenPoints = groundTruthPoints.map((point) => ({ x: point.x * scale, y: point.y * scale }));
  const groundTruthEntries = activeVertexKeys.map((key) => [key, activeGroundTruth[key]] as [string, AnnotationPoint]);
  const filteredImages = useMemo(() => {
    const q = gallerySearch.trim().toLowerCase();
    if (!q) return images;
    return images.filter((img) => img.id.toLowerCase().includes(q) || img.name.toLowerCase().includes(q));
  }, [images, gallerySearch]);
  const totalGalleryPages = Math.max(1, Math.ceil(filteredImages.length / THUMBNAILS_PER_PAGE));
  const pagedImages = useMemo(() => {
    const start = (galleryPage - 1) * THUMBNAILS_PER_PAGE;
    return filteredImages.slice(start, start + THUMBNAILS_PER_PAGE);
  }, [filteredImages, galleryPage]);
  useEffect(() => {
    setGalleryPage((prev) => Math.min(Math.max(1, prev), totalGalleryPages));
  }, [totalGalleryPages]);

  useEffect(() => () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const canAnnotate = Boolean(activeImage);
  const activeImageStatus: QAStatus = activeImage
    ? (qaStatusByImage[activeImage.id] ?? 'not_yet')
    : 'not_yet';
  editUnlockedByImageRef.current = editUnlockedByImage;
  const isActiveImageEditUnlocked = activeImage ? Boolean(editUnlockedByImage[activeImage.id]) : false;
  const isStageLocked = canAnnotate && (activeImageStatus === 'completed' || activeImageStatus === 'no_action') && !isActiveImageEditUnlocked;
  const canEditAnnotation = canAnnotate && !isStageLocked;
  const isUserAssigned = assignedUser.trim().length > 0;
  const hasAllVertices = activeVertexKeys.every((key) => {
    const point = activeGroundTruth[key];
    return point.x !== null && point.y !== null;
  });
  const hasNegativeCoordinates = activeVertexKeys.some((key) => {
    const point = activeGroundTruth[key];
    return (point.x !== null && point.x < 0) || (point.y !== null && point.y < 0);
  });
  const hasOutOfBoundsCoordinates = activeVertexKeys.some((key) => {
    const point = activeGroundTruth[key];
    return (point.x !== null && point.x > BASE_IMAGE_WIDTH) || (point.y !== null && point.y > BASE_IMAGE_HEIGHT);
  });
  const filledVertexCount = activeVertexKeys.filter((key) => {
    const point = activeGroundTruth[key];
    return point.x !== null && point.y !== null;
  }).length;
  const missingVertexCount = activeVertexKeys.length - filledVertexCount;
  const canSaveCurrent = canEditAnnotation && isUserAssigned && hasAllVertices && !hasNegativeCoordinates && !hasOutOfBoundsCoordinates;
  const canDownloadGroundTruth = canAnnotate && activeImageStatus === 'completed';
  const canNoAction = canAnnotate && activeImageStatus !== 'completed' && activeImageStatus !== 'no_action' && isUserAssigned;
  const saveBlockedReason = !canAnnotate
    ? 'Select an image to enable Save.'
    : isStageLocked
      ? 'Image is locked after save. Click Unlock to edit.'
    : !isUserAssigned
      ? 'Assign user before saving.'
      : !hasAllVertices
        ? `Fill all six vertices before saving (${missingVertexCount} missing).`
        : hasNegativeCoordinates
          ? 'One or more coordinates are negative. Adjust points within the image bounds.'
          : hasOutOfBoundsCoordinates
            ? 'One or more coordinates exceed the image bounds (1920×1080).'
            : '';
  const stageWidth = BASE_IMAGE_WIDTH * scale;
  const stageHeight = BASE_IMAGE_HEIGHT * scale;
  const magnifierOffsetX = mousePx ? -mousePx.x * magnifierZoom + LENS_SIZE / 2 : 0;
  const magnifierOffsetY = mousePx ? -mousePx.y * magnifierZoom + LENS_SIZE / 2 : 0;

  const getQaStatus = (imageId: string): QAStatus => qaStatusByImage[imageId] ?? 'not_yet';

  const refreshImageUrl = async (imageId: string) => {
    if (!imageId) {
      return;
    }

    if (refreshingImageIdsRef.current.has(imageId)) {
      return;
    }

    const attempts = imageRefreshAttemptsRef.current[imageId] ?? 0;
    if (attempts >= 2) {
      setStatusMessage('Image failed to load. Check S3 access or refresh the page.');
      return;
    }

    refreshingImageIdsRef.current.add(imageId);
    imageRefreshAttemptsRef.current[imageId] = attempts + 1;

    try {
      const response = await fetch(`${API_BASE_URL}/api/requests/${encodeURIComponent(imageId)}/image-url`);
      const data = await response.json();
      if (!response.ok || !data?.image_url) {
        throw new Error(data?.detail ?? 'Failed to refresh image URL');
      }

      setImages((prev) => prev.map((image) => (
        image.id === imageId
          ? { ...image, src: data.image_url, isObjectUrl: false }
          : image
      )));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh image URL';
      setStatusMessage(message);
    } finally {
      refreshingImageIdsRef.current.delete(imageId);
    }
  };



  const formatUpdatedAt = (isoDate: string) => {
    const parsed = new Date(isoDate);
    if (Number.isNaN(parsed.getTime())) {
      return 'Unknown';
    }
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(parsed);
  };

  const setImageStatus = (imageId: string, status: QAStatus) => {
    setQaStatusByImage((prev) => ({ ...prev, [imageId]: status }));
  };

  const acquireLock = async (image: QAImage): Promise<boolean> => {
    const user = assignedUser.trim();
    if (!user) {
      return true;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_id: image.id, image_name: image.name, assigned_user: user })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail ?? 'Lock failed');
      }

      setLockOwnerByImage((prev) => ({ ...prev, [image.id]: user }));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lock failed';
      setStatusMessage(message);
      return false;
    }
  };

  const releaseLock = async (image: QAImage | null) => {
    if (!image) {
      return;
    }

    const owner = lockOwnerByImage[image.id];
    if (!owner) {
      return;
    }

    try {
      await fetch(`${API_BASE_URL}/api/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_id: image.id, image_name: image.name, assigned_user: owner })
      });
      setLockOwnerByImage((prev) => ({ ...prev, [image.id]: null }));
    } catch {
      // Ignore unlock failures on client-side navigation.
    }
  };

  const selectImageWithLock = async (image: QAImage) => {
    if (activeImage && activeImage.id === image.id) {
      setPage('studio');
      return;
    }

    // If no user is assigned, still allow browsing between thumbnails.
    // Locking is enabled automatically once a user is provided.
    if (!assignedUser.trim()) {
      setActiveImageId(image.id);
      setPage('studio');
      setStatusMessage(`Opened ${image.name}. No user assigned yet.`);
      return;
    }

    const ok = await acquireLock(image);
    if (!ok) {
      return;
    }

    await releaseLock(activeImage);
    setActiveImageId(image.id);
    setPage('studio');
  };

  const setPoint = (pointKey: string, nextPoint: AnnotationPoint) => {
    if (!activeImage || !canEditAnnotation) {
      return;
    }

    setAnnotations((prev) => ({
      ...prev,
      [activeImage.id]: {
        ...(prev[activeImage.id] ?? createEmptyAnnotation(activeVertexCount)),
        [pointKey]: nextPoint
      }
    }));

    const currentStatus = getQaStatus(activeImage.id);
    if (currentStatus !== 'in_progress') {
      setImageStatus(activeImage.id, 'in_progress');
    }
  };

  const handleDrag = (key: string, event: KonvaEventObject<DragEvent>) => {
    setPoint(key, { x: event.target.x() / scale, y: event.target.y() / scale });
    setMousePx({ x: event.target.x(), y: event.target.y() });
  };

  const startAnnotating = () => {
    setIsAnnotating(true);
  };

  const endAnnotating = () => {
    setIsAnnotating(false);
  };

  const handleCoordinateChange = (key: string, axis: 'x' | 'y', value: string) => {
    if (!canEditAnnotation) {
      return;
    }

    const currentPoint = activeGroundTruth[key];
    if (value.trim() === '') {
      setPoint(key, { ...currentPoint, [axis]: null });
      return;
    }

    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
      return;
    }

    setPoint(key, { ...currentPoint, [axis]: numericValue });
  };

  const updateZoom = (nextScale: number) => {
    const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
    setScale(clampedScale);
  };

  const zoomIn = () => updateZoom(scale + ZOOM_STEP);
  const zoomOut = () => updateZoom(scale - ZOOM_STEP);
  const resetZoom = () => updateZoom(DEFAULT_SCALE);

  const handleCanvasWheel: React.WheelEventHandler<HTMLDivElement> = (event) => {
    if (!canAnnotate) {
      return;
    }

    // Keep normal two-finger scrolling for panning around a zoomed canvas.
    // Use pinch/gesture wheel (ctrl/meta) for zooming.
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }

    event.preventDefault();
    const delta = event.deltaY;
    if (delta < 0) {
      updateZoom(scale + ZOOM_STEP);
    } else {
      updateZoom(scale - ZOOM_STEP);
    }
  };

  const handleCanvasMouseDown: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (!canAnnotate || !isSpacePressed || scale <= 1) {
      return;
    }

    const wrap = canvasWrapRef.current;
    if (!wrap) {
      return;
    }

    panStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: wrap.scrollLeft,
      top: wrap.scrollTop,
    };
    setIsPanning(true);
    event.preventDefault();
  };

  const handleCanvasMouseMove: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (!isPanning || !panStartRef.current || !canvasWrapRef.current) {
      return;
    }

    const dx = event.clientX - panStartRef.current.x;
    const dy = event.clientY - panStartRef.current.y;
    canvasWrapRef.current.scrollLeft = panStartRef.current.left - dx;
    canvasWrapRef.current.scrollTop = panStartRef.current.top - dy;
  };

  const stopPanning = () => {
    setIsPanning(false);
    panStartRef.current = null;
  };

  const fitToViewport = () => {
    const wrap = canvasWrapRef.current;
    if (!wrap) {
      return;
    }

    const availableWidth = Math.max(340, wrap.clientWidth - 26);
    const availableHeight = Math.max(280, wrap.clientHeight - 26);
    const fitScale = Math.min(availableWidth / BASE_IMAGE_WIDTH, availableHeight / BASE_IMAGE_HEIGHT);
    updateZoom(fitScale);
  };

  const maximizeView = () => updateZoom(1);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || target?.isContentEditable;
      if (isTyping) {
        return;
      }

      if (event.key === 'h' || event.key === 'H') {
        setPage('home');
      }
      if (event.key === 'a' || event.key === 'A') {
        event.preventDefault();
        openStudio();
      }
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomIn();
      }
      if (event.key === '-') {
        event.preventDefault();
        zoomOut();
      }
      if (event.key === '0') {
        event.preventDefault();
        resetZoom();
      }
      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        fitToViewport();
      }
      if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        setShowMagnifier((value) => !value);
      }

      if (event.code === 'Space') {
        setIsSpacePressed(true);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        setIsSpacePressed(false);
        stopPanning();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [canAnnotate, scale, showMagnifier, page, activeImageId]);

  useEffect(() => {
    if (page === 'studio' && canAnnotate) {
      fitToViewport();
    }
  }, [page, activeImageId]);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/me`);
        const data = await response.json();
        const user = typeof data?.user === 'string' ? data.user.trim() : '';
        if (response.ok && user) {
          setAssignedUser(user);
          setIsAssignedUserLocked(true);
          setStatusMessage(`Signed in as ${user}. Requests will auto-assign to you.`);
        }
      } catch {
        // Keep manual assignment as fallback in local/dev mode.
      }
    };

    void loadCurrentUser();
  }, []);


  useEffect(() => {
    if (imgStatus !== 'failed' || !activeImageId) {
      return;
    }
    void refreshImageUrl(activeImageId);
  }, [imgStatus, activeImageId]);

  // Heartbeat: refresh the lock every 5 min so it doesn't expire while the user is active.
  // If the browser closes without calling releaseLock, the lock auto-expires after 10 min.
  useEffect(() => {
    if (!activeImage || !assignedUser.trim()) return;
    const interval = setInterval(async () => {
      try {
        await fetch(`${API_BASE_URL}/api/lock-heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_id: activeImage.id, image_name: activeImage.name, assigned_user: assignedUser.trim() }),
        });
      } catch {
        // Non-fatal — lock will auto-expire if the browser truly closes.
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [activeImage?.id, assignedUser]);

  const resetPointsForActiveImage = () => {
    if (!activeImage || !canEditAnnotation) {
      return;
    }

    setAnnotations((prev) => ({ ...prev, [activeImage.id]: seedVertices(activeVertexCount) }));
    setImageStatus(activeImage.id, 'not_yet');
    setStatusMessage(`Polygon reset for ${activeImage.name}.`);
  };


  const handleStageMouseMove = () => {
    if (!showMagnifier || !canAnnotate) {
      return;
    }

    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return;
    }

    const x = pointer.x;
    const y = pointer.y;
    if (x < 0 || y < 0 || x > stageWidth || y > stageHeight) {
      setMousePx(null);
      return;
    }
    setMousePx({ x, y });

  };

  const handleCanvasLeave = () => {
    setMousePx(null);
    setIsAnnotating(false);
    stopPanning();
  };

  const buildSanitizedGroundTruth = (): ReferenceMap =>
    Object.fromEntries(
      activeVertexKeys.flatMap((key) => {
        const point = activeGroundTruth[key];
        if (point.x === null || point.y === null) {
          return [];
        }
        return [[key, { x: point.x, y: point.y }]];
      })
    ) as ReferenceMap;

  const downloadGroundTruth = () => {
    if (!activeImage) {
      setStatusMessage('Select an image before downloading ground truth.');
      return;
    }

    if (!canDownloadGroundTruth) {
      setStatusMessage('Save annotation before downloading GT JSON.');
      return;
    }

    const sanitizedGroundTruth = buildSanitizedGroundTruth();
    const downloadData = JSON.stringify(sanitizedGroundTruth, null, 2);
    const blob = new Blob([downloadData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeImage.name.replace(/\.[^/.]+$/, '') || 'ground_truth'}.ground_truth.json`;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

    setStatusMessage(`Downloaded ground truth for ${activeImage.name}.`);
  };

  const save = async () => {
    if (!activeImage) {
      setStatusMessage('Select an image to annotate before saving.');
      return;
    }

    if (isStageLocked) {
      setStatusMessage('Image is locked after save. Click Unlock to edit.');
      return;
    }

    if (!isUserAssigned) {
      setStatusMessage('Assign user before saving.');
      return;
    }

    if (!hasAllVertices) {
      setStatusMessage('Fill all six vertices before saving.');
      return;
    }

    const saveUser = assignedUser.trim();
    const sanitizedGroundTruth = buildSanitizedGroundTruth();

    try {
      setStatusMessage('Saving...');

      const response = await fetch(`${API_BASE_URL}/api/calibrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigned_user: saveUser,
          image_id: activeImage.id,
          image_name: activeImage.name,
          qa_status: 'completed',
          ground_truth: sanitizedGroundTruth
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail ?? 'Save failed');
      }

      setImageStatus(activeImage.id, 'completed');
      setEditUnlockedByImage((prev) => ({ ...prev, [activeImage.id]: false }));
      setCompletionMetaByImage((prev) => ({
        ...prev,
        [activeImage.id]: {
          user: saveUser,
          updatedAt: typeof data?.updated_at === 'string' ? data.updated_at : new Date().toISOString()
        }
      }));

      setStatusMessage(
        `Saved ${activeImage.name} to ${data.database}.${data.collection} (${data.id}) ✓`
      );

      const currentIndex = images.findIndex((image) => image.id === activeImage.id);
      const nextImage = currentIndex >= 0 ? images[currentIndex + 1] : undefined;
      const promptMessage = nextImage
        ? `Saved ${activeImage.name}. Open next image (${nextImage.name})?`
        : `Saved ${activeImage.name}. Stay on current image?`;

      const shouldSwitch = window.confirm(promptMessage);
      if (shouldSwitch && nextImage) {
        await selectImageWithLock(nextImage);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setStatusMessage(`Save failed: ${message}`);
    }
  };


  const unlockImageForEditing = async (image: QAImage) => {
    const imageStatus = getQaStatus(image.id);
    if (imageStatus !== 'completed' && imageStatus !== 'no_action') {
      setStatusMessage('Save annotation first, then unlock for edits if needed.');
      return;
    }

    const unlockUser = assignedUser.trim();
    if (!unlockUser) {
      setStatusMessage('Assign user before unlocking.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/stage-unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_id: image.id,
          image_name: image.name,
          assigned_user: unlockUser,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail ?? 'Unlock failed');
      }

      setImageStatus(image.id, 'in_progress');
      setCompletionMetaByImage((prev) => ({
        ...prev,
        [image.id]: {
          user: unlockUser,
          updatedAt: typeof data?.updated_at === 'string' ? data.updated_at : new Date().toISOString(),
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unlock failed';
      setStatusMessage(`Unlock failed: ${message}`);
      return;
    }

    setEditUnlockedByImage((prev) => ({ ...prev, [image.id]: true }));
    setStatusMessage(`Unlocked ${image.name}. You can now edit and save again.`);
  };

  const unlockForEditing = async () => {
    if (!activeImage) {
      return;
    }

    await unlockImageForEditing(activeImage);
  };

  const markNoAction = async () => {
    if (!activeImage) return;
    if (!assignedUser.trim()) {
      setStatusMessage('Assign user before marking no action.');
      return;
    }
    try {
      setStatusMessage('Marking as no action...');
      const response = await fetch(`${API_BASE_URL}/api/no-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_id: activeImage.id, image_name: activeImage.name, assigned_user: assignedUser.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.detail ?? 'Failed');
      setImageStatus(activeImage.id, 'no_action');
      setEditUnlockedByImage((prev) => ({ ...prev, [activeImage.id]: false }));
      setStatusMessage(`${activeImage.name} marked as no action.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setStatusMessage(`No action failed: ${message}`);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        setStatusMessage(`Skipped ${file.name} - only image files are supported.`);
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      objectUrlsRef.current.push(objectUrl);

      const fileId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const newImage: QAImage = {
        id: fileId,
        name: file.name,
        src: objectUrl,
        isObjectUrl: true,
      };

      setImages((prev) => [...prev, newImage]);
      setVertexCountByImage((prev) => ({ ...prev, [fileId]: DEFAULT_VERTEX_COUNT }));
      setAnnotations((prev) => ({ ...prev, [fileId]: seedVertices(DEFAULT_VERTEX_COUNT) }));
      setQaStatusByImage((prev) => ({ ...prev, [fileId]: 'not_yet' }));
    });

    event.target.value = '';
    setStatusMessage(`Loaded ${files.length} image(s).`);
  };

  const openStudio = () => {
    setPage('studio');
    if (images.length === 0) {
      setStatusMessage('No images loaded. Upload an image to start annotating.');
      return;
    }
    if (!activeImage) {
      setStatusMessage('Select an image from the gallery to begin.');
    }
  };

  const goBackToThumbnails = async () => {
    if (activeImage) {
      const imageIndex = images.findIndex((imgItem) => imgItem.id === activeImage.id);
      if (imageIndex >= 0) {
        setGalleryPage(Math.floor(imageIndex / THUMBNAILS_PER_PAGE) + 1);
      }
    }
    await releaseLock(activeImage);
    setActiveImageId(null);
    setStatusMessage('Select another thumbnail to continue QA.');
  };

  return (
    <div className="qa-app">
      <header className="qa-titlebar">
        <div>
          <p className="qa-eyebrow">Polygon Annotator</p>
        </div>
      </header>

      <div className="qa-shell">
        <aside className="qa-sidebar">
          <button
            type="button"
            className={`qa-nav-btn icon-only ${page === 'home' ? 'active' : ''}`}
            onClick={() => setPage('home')}
            title="Home"
          >
            <Home size={16} />
            <span className="qa-nav-label">Home</span>
          </button>
          <button
            type="button"
            className={`qa-nav-btn icon-only ${page === 'studio' ? 'active' : ''}`}
            onClick={openStudio}
            title="Studio"
          >
            <ScanSearch size={16} />
            <span className="qa-nav-label">Studio</span>
          </button>
        </aside>

        {page === 'home' && (
          <main className="qa-home">
            <section className="qa-home-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <h2 style={{ margin: 0 }}>Getting Started</h2>
                <img
                  src="/bee.gif"
                  alt="Happy Queen Bee"
                  className="bee-fly-animated"
                  style={{ verticalAlign: 'middle', marginTop: '6px' }}
                />
              </div>
              <div className="qa-instructions">
                <ol>
                  <li><strong>Upload Images</strong> – Click the upload button in the Studio to add images locally or load from the image gallery.</li>
                  <li><strong>Place Vertices</strong> – Click on the canvas to add polygon points, or manually enter coordinates in the Coordinates panel.</li>
                  <li><strong>Refine Edges</strong> – Drag vertices to adjust boundaries. Use the magnifier tool (M) for precision placement.</li>
                  <li><strong>Compare Layers</strong> – Toggle between reference predictions and your ground truth annotations to compare changes.</li>
                  <li><strong>Status Indicators</strong>:
                    <ul style={{ marginTop: 6, marginBottom: 6 }}>
                      <li>🔴 Red – Not yet started</li>
                      <li>🟡 Yellow – In progress</li>
                      <li>🟢 Green – Completed</li>
                    </ul>
                  </li>
                  <li><strong>Save & Export</strong> – Click <strong>Save Current Annotation</strong> to persist your work, then <strong>Download GT JSON</strong> to export as JSON.</li>
                  <li><strong>Keyboard Shortcuts</strong>:
                    <ul style={{ marginTop: 6, marginBottom: 6 }}>
                      <li>H – Home</li>
                      <li>A – Open Studio</li>
                      <li>+/- – Zoom in/out</li>
                      <li>0 – Reset zoom</li>
                      <li>F – Fit to screen</li>
                      <li>M – Toggle magnifier</li>
                      <li>Space + Drag – Pan image</li>
                    </ul>
                  </li>
                </ol>
              </div>
            </section>
          </main>
        )}

        {page === 'studio' && (
          <main className="qa-main-grid">
            <section className="qa-workspace">
              {!activeImage && (
                <section className="qa-gallery">
                  <h2>Image Gallery</h2>
                  <p>Select an image to begin annotating.</p>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <input
                      className="qa-search"
                      type="search"
                      placeholder="Search by name..."
                      value={gallerySearchInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGallerySearchInput(val);
                        if (gallerySearchDebounceRef.current) clearTimeout(gallerySearchDebounceRef.current);
                        gallerySearchDebounceRef.current = setTimeout(() => {
                          setGallerySearch(val);
                          setGalleryPage(1);
                        }, 250);
                      }}
                      style={{ flex: 1 }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <Upload size={16} />
                      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Upload</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                  <div className="qa-gallery-grid" role="list" aria-label="Image gallery">
                    {pagedImages.map((image) => {
                      const status = getQaStatus(image.id);
                      const isThumbnailUnlocked = Boolean(editUnlockedByImage[image.id]);
                      const thumbnailVertexCount = vertexCountByImage[image.id] ?? DEFAULT_VERTEX_COUNT;
                      const thumbnailGroundTruth = annotations[image.id] ?? createEmptyAnnotation(thumbnailVertexCount);
                      const thumbnailGroundTruthPoints = getVertexKeys(thumbnailVertexCount)
                        .map((key) => thumbnailGroundTruth[key])
                        .filter((point): point is Point => point.x !== null && point.y !== null);
                      return (
                        <div key={image.id} className="qa-gallery-tile">
                          <button
                            className="qa-gallery-open"
                            onClick={() => {
                              void selectImageWithLock(image);
                            }}
                            type="button"
                          >
                            <div className="qa-gallery-thumb">
                              <img
                                src={image.src}
                                alt={image.name}
                                onError={() => {
                                  void refreshImageUrl(image.id);
                                }}
                              />
                              {thumbnailGroundTruthPoints.length > 0 && (
                                <svg
                                  className="qa-gallery-overlay"
                                  viewBox={`0 0 ${BASE_IMAGE_WIDTH} ${BASE_IMAGE_HEIGHT}`}
                                  preserveAspectRatio="none"
                                  aria-hidden="true"
                                >
                                  {thumbnailGroundTruthPoints.length > 1 && (
                                    <polyline
                                      points={thumbnailGroundTruthPoints.map((point) => `${point.x},${point.y}`).join(' ')}
                                      fill="none"
                                      stroke={POLY_COLOR}
                                      strokeWidth={14}
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  )}
                                  {thumbnailGroundTruthPoints.length > 2 && (
                                    <polygon
                                      points={thumbnailGroundTruthPoints.map((point) => `${point.x},${point.y}`).join(' ')}
                                      fill="rgba(255, 85, 0, 0.12)"
                                    />
                                  )}
                                  {thumbnailGroundTruthPoints.map((point, index) => (
                                    <circle
                                      key={`${image.id}-thumb-gt-${index}`}
                                      cx={point.x}
                                      cy={point.y}
                                      r={16}
                                      fill={POLY_COLOR}
                                      opacity={0.92}
                                    />
                                  ))}
                                </svg>
                              )}
                            </div>
                            <span className="qa-gallery-title" title={image.id}>{image.id}</span>
                            {status === 'completed' && completionMetaByImage[image.id] && (
                              <div className="qa-gallery-meta">
                                <span className="qa-gallery-meta-user">User: {completionMetaByImage[image.id].user}</span>
                                <span className="qa-gallery-meta-time">Updated: {formatUpdatedAt(completionMetaByImage[image.id].updatedAt)}</span>
                              </div>
                            )}
                            <span className={`qa-status-dot ${status}`} />
                          </button>
                          {status === 'completed' && !isThumbnailUnlocked && (
                            <button
                              className="qa-gallery-unlock"
                              type="button"
                              title="Unlock for edits"
                              onClick={() => { void unlockImageForEditing(image); }}
                            >
                              <Lock size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {pagedImages.length === 0 && <p className="qa-empty-inline">No images loaded yet.</p>}
                  </div>
                  {images.length > THUMBNAILS_PER_PAGE && (
                    <div className="qa-gallery-pager" aria-label="Gallery pagination">
                      <button
                        type="button"
                        onClick={() => setGalleryPage((prev) => Math.max(1, prev - 1))}
                        disabled={galleryPage === 1}
                      >
                        Previous
                      </button>
                      <span>Page {galleryPage} / {totalGalleryPages}</span>
                      <button
                        type="button"
                        onClick={() => setGalleryPage((prev) => Math.min(totalGalleryPages, prev + 1))}
                        disabled={galleryPage >= totalGalleryPages}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </section>
              )}

              {activeImage && (
                <>
              <div className="qa-workspace-toolbar">
                <button
                  type="button"
                  className="qa-back-lake-btn"
                  onClick={() => { void goBackToThumbnails(); }}
                >
                  Back to Gallery
                </button>
                <strong title={activeImage.name}>{activeImage.name}</strong>
              </div>

              <div
                ref={canvasWrapRef}
                className={`qa-canvas-wrap ${isPanning ? 'panning' : isSpacePressed ? 'pan-ready' : ''}`}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={stopPanning}
                onMouseLeave={handleCanvasLeave}
                onWheel={handleCanvasWheel}
              >
                {!canAnnotate && <div className="qa-empty-canvas">No active request selected. Sync or claim from the queue.</div>}
                {canAnnotate && (
                  <Stage
                    ref={stageRef}
                    width={stageWidth}
                    height={stageHeight}
                    className="qa-stage"
                    onMouseMove={handleStageMouseMove}
                    onTouchMove={handleStageMouseMove}
                    onMouseLeave={handleCanvasLeave}
                  >
                    <Layer>
                      {img && <KonvaImage image={img} width={stageWidth} height={stageHeight} className="qa-annot-image" />}
                      {showAnnotation && groundTruthScreenPoints.length > 1 && (
                        <Line
                          points={groundTruthScreenPoints.flatMap((point) => [point.x, point.y])}
                          stroke={POLY_COLOR}
                          strokeWidth={annotationLineWidth}
                          closed={groundTruthScreenPoints.length > 2}
                          shadowBlur={8}
                          shadowColor={POLY_COLOR}
                        />
                      )}
                      {showAnnotation &&
                        groundTruthEntries.map(([key, point]) => {
                          const isSet = point.x !== null && point.y !== null;
                          const x = (point.x ?? BASE_IMAGE_WIDTH / 2) * scale;
                          const y = (point.y ?? BASE_IMAGE_HEIGHT / 2) * scale;

                          return (
                            <Circle
                              key={key}
                              x={x}
                              y={y}
                              radius={5}
                              fill={isSet ? POLY_COLOR : '#e0e7ff'}
                              opacity={isSet ? 0.94 : 0.7}
                              stroke={isSet ? '#3730a3' : '#818cf8'}
                              strokeWidth={1}
                              draggable={canEditAnnotation}
                              dragBoundFunc={(pos) => ({
                                x: Math.max(0, Math.min(stageWidth, pos.x)),
                                y: Math.max(0, Math.min(stageHeight, pos.y)),
                              })}
                              onDragStart={startAnnotating}
                              onDragMove={(event: KonvaEventObject<DragEvent>) => handleDrag(key, event)}
                              onDragEnd={endAnnotating}
                            />
                          );
                        })}
                    </Layer>
                  </Stage>
                )}



              </div>
                </>
              )}
            </section>

            <aside className="qa-panel qa-panel-side">
                        {canAnnotate && showMagnifier && isAnnotating && mousePx && (
                          <section className="qa-magnifier-panel">
                            <h3 style={{marginTop:0,marginBottom:8,fontWeight:600}}>Magnifier</h3>
                            <Stage width={LENS_SIZE} height={LENS_SIZE} className="qa-magnifier-stage">
                              <Layer>
                                {img && (
                                  <KonvaImage
                                    image={img}
                                    x={magnifierOffsetX}
                                    y={magnifierOffsetY}
                                    width={stageWidth * magnifierZoom}
                                    height={stageHeight * magnifierZoom}
                                  />
                                )}
                                {showAnnotation && groundTruthScreenPoints.length > 1 && (
                                  <Line
                                    points={groundTruthScreenPoints.flatMap((point) => [
                                      point.x * magnifierZoom + magnifierOffsetX,
                                      point.y * magnifierZoom + magnifierOffsetY
                                    ])}
                                    stroke={POLY_COLOR}
                                    strokeWidth={Math.max(1.5, annotationLineWidth * 0.8)}
                                    closed={groundTruthScreenPoints.length > 2}
                                  />
                                )}
                                <Line points={[LENS_SIZE / 2, 0, LENS_SIZE / 2, LENS_SIZE]} stroke="rgba(0,0,0,0.35)" />
                                <Line points={[0, LENS_SIZE / 2, LENS_SIZE, LENS_SIZE / 2]} stroke="rgba(0,0,0,0.35)" />
                              </Layer>
                            </Stage>
                          </section>
                        )}
          <section className="qa-card">
            <h2>Session Setup</h2>
            <label>
              {isAssignedUserLocked ? 'Logged In User' : 'Assign User'}
              <input
                value={assignedUser}
                onChange={(event) => setAssignedUser(event.target.value)}
                readOnly={isAssignedUserLocked}
              />
            </label>
          </section>


          <section className="qa-card">
            <h2>Zoom</h2>
            <div className="qa-row">
              <button onClick={zoomOut} type="button">-</button>
              <button onClick={zoomIn} type="button">+</button>
              <button onClick={resetZoom} type="button">Reset</button>
              <button onClick={fitToViewport} type="button" disabled={!canAnnotate}>Fit</button>
              <button onClick={maximizeView} type="button" disabled={!canAnnotate}>Max</button>
            </div>
            <input
              type="range"
              min={MIN_SCALE}
              max={MAX_SCALE}
              step={0.01}
              value={scale}
              onChange={(event) => updateZoom(Number(event.target.value))}
              disabled={!canAnnotate}
            />
          </section>

          <section className="qa-card">
            <h2>Coordinates</h2>
            <div className="qa-coord-list">
              {groundTruthEntries.map(([key, point]) => (
                <div key={key} className="qa-coord-row">
                  <strong>{key}</strong>
                  <input
                    type="number"
                    value={point.x === null ? '' : Math.round(point.x)}
                    onChange={(event) => handleCoordinateChange(key, 'x', event.target.value)}
                    disabled={!canEditAnnotation}
                  />
                  <input
                    type="number"
                    value={point.y === null ? '' : Math.round(point.y)}
                    onChange={(event) => handleCoordinateChange(key, 'y', event.target.value)}
                    disabled={!canEditAnnotation}
                  />
                </div>
              ))}
            </div>
            <div className="qa-row qa-row-wrap">
              <button onClick={resetPointsForActiveImage} type="button" disabled={!canEditAnnotation}>Clear All</button>
            </div>
          </section>

          <section className="qa-card">
            <h2>Polygon</h2>
            <label>
              Vertices (min 4)
              <input
                type="number"
                min={4}
                max={32}
                value={activeVertexCount}
                onChange={(e) => {
                  const n = Math.max(4, Number(e.target.value));
                  if (!activeImage) return;
                  setVertexCountByImage((prev) => ({ ...prev, [activeImage.id]: n }));
                  setAnnotations((prev) => ({
                    ...prev,
                    [activeImage.id]: seedVertices(n)
                  }));
                  setQaStatusByImage((prev) => ({ ...prev, [activeImage.id]: 'not_yet' }));
                }}
                disabled={!canAnnotate || isStageLocked}
              />
            </label>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: '6px 0 0' }}>
              {activeVertexCount === 4 ? 'Bounding box (4-point rectangle)' : `${activeVertexCount}-sided polygon`}
            </p>
          </section>

          <section className="qa-card">
            <h2>Visibility</h2>
            <div className="qa-toggle-list">
              <label className="qa-toggle-pill">
                <input
                  type="checkbox"
                  checked={showAnnotation}
                  onChange={(event) => setShowAnnotation(event.target.checked)}
                  disabled={!canAnnotate}
                />
                <span>Show Polygon</span>
              </label>
              <label className="qa-toggle-pill">
                <input
                  type="checkbox"
                  checked={showMagnifier}
                  onChange={(event) => setShowMagnifier(event.target.checked)}
                  disabled={!canAnnotate}
                />
                <span>Magnifier</span>
              </label>
              <label>
                Line Thickness
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={0.5}
                  value={annotationLineWidth}
                  onChange={(event) => setAnnotationLineWidth(Number(event.target.value))}
                  disabled={!canAnnotate || !showAnnotation}
                />
              </label>
              <label>
                Magnifier Zoom
                <input
                  type="range"
                  min={1.4}
                  max={4}
                  step={0.1}
                  value={magnifierZoom}
                  onChange={(event) => setMagnifierZoom(Number(event.target.value))}
                  disabled={!canAnnotate || !showMagnifier}
                />
              </label>
            </div>
          </section>

          <div className="qa-row qa-row-wrap">
            <button className="qa-primary-btn" onClick={save} type="button" disabled={!canSaveCurrent}>
              Save Current Annotation
            </button>
            <button className="qa-no-action-btn" onClick={markNoAction} type="button" disabled={!canNoAction}>
              No Action Required
            </button>
            <button onClick={downloadGroundTruth} type="button" disabled={!canDownloadGroundTruth}>
              Download GT JSON
            </button>
            <button
              onClick={() => { void unlockForEditing(); }}
              type="button"
              disabled={!canAnnotate || (activeImageStatus !== 'completed' && activeImageStatus !== 'no_action') || isActiveImageEditUnlocked}
            >
              Unlock
            </button>
          </div>
          {!canSaveCurrent && <p className="qa-save-warning">{saveBlockedReason}</p>}
          <p className="qa-status">{statusMessage}</p>
            </aside>
          </main>
        )}

      </div>
    </div>
  );
}