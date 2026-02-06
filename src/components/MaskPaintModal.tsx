/**
 * MaskPaintModal - Mask painting tool for LipSync mouth region
 *
 * Features:
 * - Brush paint/erase modes
 * - Adjustable brush size
 * - Zoom/Pan navigation
 * - Undo/Redo (single level)
 * - Outputs 8-bit grayscale PNG mask (0=hidden, 255=visible)
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Brush,
  Eraser,
  ZoomIn,
  ZoomOut,
  Move,
  Undo2,
  Redo2,
  RotateCcw,
  Check,
} from "lucide-react";
import { Overlay, Header } from "../ui/primitives/Modal";
import "./MaskPaintModal.css";

interface MaskPaintModalProps {
  /** Base image to paint mask on (data URL or path) */
  baseImage: string;
  /** Image width in pixels */
  imageWidth: number;
  /** Image height in pixels */
  imageHeight: number;
  /** Existing mask data URL (optional) */
  existingMask?: string;
  /** Called when mask is saved */
  onSave: (maskDataUrl: string) => void;
  /** Called when modal is closed */
  onClose: () => void;
}

type Tool = "brush" | "eraser" | "pan";

interface CanvasState {
  imageData: ImageData;
}

export default function MaskPaintModal({
  baseImage,
  imageWidth,
  imageHeight,
  existingMask,
  onSave,
  onClose,
}: MaskPaintModalProps) {
  // Canvas refs
  const containerRef = useRef<HTMLDivElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Tool state
  const [tool, setTool] = useState<Tool>("brush");
  const [brushSize, setBrushSize] = useState(30);

  // Zoom/Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Drawing state
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  // Undo/Redo state (single level)
  const [undoState, setUndoState] = useState<CanvasState | null>(null);
  const [redoState, setRedoState] = useState<CanvasState | null>(null);

  // Pan drag state
  const isPanningRef = useRef(false);

  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Fit canvas to container
  const fitToContainer = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const padding = 40;
    const availableWidth = containerRect.width - padding * 2;
    const availableHeight = containerRect.height - padding * 2;

    const scaleX = availableWidth / imageWidth;
    const scaleY = availableHeight / imageHeight;
    const fitZoom = Math.min(scaleX, scaleY, 1);

    setZoom(fitZoom);
    setPan({ x: 0, y: 0 });
  }, [imageWidth, imageHeight]);

  // Initialize canvases
  useEffect(() => {
    const baseCanvas = baseCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!baseCanvas || !maskCanvas || !overlayCanvas) return;

    // Set canvas dimensions
    baseCanvas.width = imageWidth;
    baseCanvas.height = imageHeight;
    maskCanvas.width = imageWidth;
    maskCanvas.height = imageHeight;
    overlayCanvas.width = imageWidth;
    overlayCanvas.height = imageHeight;

    const baseCtx = baseCanvas.getContext("2d");
    const maskCtx = maskCanvas.getContext("2d");
    if (!baseCtx || !maskCtx) return;

    // Load base image
    const img = new Image();
    img.onload = () => {
      baseCtx.drawImage(img, 0, 0, imageWidth, imageHeight);
      // Fit to container after image loads
      requestAnimationFrame(() => {
        fitToContainer();
      });
    };
    img.onerror = () => {
      console.error("Failed to load base image:", baseImage.substring(0, 100));
      // Still fit to container even if image fails
      fitToContainer();
    };
    img.src = baseImage;

    // Load existing mask or initialize transparent
    if (existingMask) {
      const maskImg = new Image();
      maskImg.onload = () => {
        maskCtx.drawImage(maskImg, 0, 0, imageWidth, imageHeight);
      };
      maskImg.src = existingMask;
    } else {
      // Start with fully transparent mask
      maskCtx.clearRect(0, 0, imageWidth, imageHeight);
    }
  }, [baseImage, imageWidth, imageHeight, existingMask, fitToContainer]);

  // Get canvas position from mouse event
  const getCanvasPos = useCallback(
    (e: React.MouseEvent) => {
      const baseCanvas = baseCanvasRef.current;
      if (!baseCanvas) return { x: 0, y: 0 };

      const rect = baseCanvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;

      return { x, y };
    },
    [zoom]
  );

  // Save current state for undo
  const saveUndoState = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, imageWidth, imageHeight);
    setUndoState({ imageData });
    setRedoState(null); // Clear redo when new action is taken
  }, [imageWidth, imageHeight]);

  // Draw brush stroke
  const drawStroke = useCallback(
    (fromX: number, fromY: number, toX: number, toY: number) => {
      const maskCanvas = maskCanvasRef.current;
      if (!maskCanvas) return;

      const ctx = maskCanvas.getContext("2d");
      if (!ctx) return;

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = brushSize;

      if (tool === "brush") {
        // Paint white (visible in mask)
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = "white";
      } else if (tool === "eraser") {
        // Erase (make transparent)
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
      }

      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();

      // Reset composite operation
      ctx.globalCompositeOperation = "source-over";
    },
    [tool, brushSize]
  );

  // Update overlay cursor preview
  const updateOverlay = useCallback(
    (x: number, y: number) => {
      const overlayCanvas = overlayCanvasRef.current;
      if (!overlayCanvas) return;

      overlayCanvas.width = imageWidth;
      overlayCanvas.height = imageHeight;

      const ctx = overlayCanvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, imageWidth, imageHeight);

      // Draw brush cursor
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.stroke();
    },
    [tool, brushSize, zoom, imageWidth, imageHeight]
  );

  // Mouse handlers - attached to container for pan to work across boundaries
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (tool === "pan") {
        isPanningRef.current = true;
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          panX: pan.x,
          panY: pan.y,
        };
        return;
      }

      // Only draw if clicking on the canvas area
      const canvas = baseCanvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        return;
      }

      // Save undo state before starting to draw
      saveUndoState();

      isDrawingRef.current = true;
      const pos = getCanvasPos(e);
      lastPosRef.current = pos;

      // Draw initial point
      drawStroke(pos.x, pos.y, pos.x, pos.y);
    },
    [tool, pan, getCanvasPos, saveUndoState, drawStroke]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      // Handle panning (works even outside canvas)
      if (tool === "pan" && isPanningRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        setPan({
          x: panStartRef.current.panX + dx,
          y: panStartRef.current.panY + dy,
        });
        return;
      }

      const pos = getCanvasPos(e);

      // Update cursor overlay
      if (tool !== "pan") {
        updateOverlay(pos.x, pos.y);
      }

      if (!isDrawingRef.current) return;

      drawStroke(lastPosRef.current.x, lastPosRef.current.y, pos.x, pos.y);
      lastPosRef.current = pos;
    },
    [tool, getCanvasPos, updateOverlay, drawStroke]
  );

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDrawingRef.current = false;
    isPanningRef.current = false;
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Don't stop panning when leaving - user might drag outside
    isDrawingRef.current = false;

    // Clear overlay
    const overlayCanvas = overlayCanvasRef.current;
    if (overlayCanvas) {
      const ctx = overlayCanvas.getContext("2d");
      ctx?.clearRect(0, 0, imageWidth, imageHeight);
    }
  }, [imageWidth, imageHeight]);

  // Global mouse up to handle releasing outside the container
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isDrawingRef.current = false;
      isPanningRef.current = false;
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z * 1.25, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z / 1.25, 0.1));
  }, []);

  const handleZoomFit = useCallback(() => {
    fitToContainer();
  }, [fitToContainer]);

  // Undo/Redo handlers
  const handleUndo = useCallback(() => {
    if (!undoState) return;

    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    // Save current state to redo
    const currentImageData = ctx.getImageData(0, 0, imageWidth, imageHeight);
    setRedoState({ imageData: currentImageData });

    // Restore undo state
    ctx.putImageData(undoState.imageData, 0, 0);
    setUndoState(null);
  }, [undoState, imageWidth, imageHeight]);

  const handleRedo = useCallback(() => {
    if (!redoState) return;

    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    // Save current state to undo
    const currentImageData = ctx.getImageData(0, 0, imageWidth, imageHeight);
    setUndoState({ imageData: currentImageData });

    // Restore redo state
    ctx.putImageData(redoState.imageData, 0, 0);
    setRedoState(null);
  }, [redoState, imageWidth, imageHeight]);

  // Clear mask
  const handleClear = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    // Save undo state
    saveUndoState();

    ctx.clearRect(0, 0, imageWidth, imageHeight);
  }, [saveUndoState, imageWidth, imageHeight]);

  // Save mask as grayscale PNG
  const handleSave = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    // Get mask data
    const imageData = ctx.getImageData(0, 0, imageWidth, imageHeight);
    const data = imageData.data;

    // Create grayscale version (use alpha channel as grayscale value)
    const grayscaleCanvas = document.createElement("canvas");
    grayscaleCanvas.width = imageWidth;
    grayscaleCanvas.height = imageHeight;
    const grayCtx = grayscaleCanvas.getContext("2d");
    if (!grayCtx) return;

    const grayImageData = grayCtx.createImageData(imageWidth, imageHeight);
    const grayData = grayImageData.data;

    for (let i = 0; i < data.length; i += 4) {
      // Use alpha channel as grayscale value (white areas become 255, transparent become 0)
      const alpha = data[i + 3];
      grayData[i] = alpha; // R
      grayData[i + 1] = alpha; // G
      grayData[i + 2] = alpha; // B
      grayData[i + 3] = 255; // Full opacity for the output
    }

    grayCtx.putImageData(grayImageData, 0, 0);

    // Export as PNG
    const maskDataUrl = grayscaleCanvas.toDataURL("image/png");
    onSave(maskDataUrl);
  }, [imageWidth, imageHeight, onSave]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      // Undo: Ctrl+Z
      if (e.ctrlKey && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((e.ctrlKey && e.shiftKey && e.key === "z") || (e.ctrlKey && e.key === "y")) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Tool shortcuts
      if (e.key === "b" || e.key === "B") {
        setTool("brush");
      } else if (e.key === "e" || e.key === "E") {
        setTool("eraser");
      } else if (e.key === " ") {
        e.preventDefault();
        setTool("pan");
      }

      // Brush size: [ and ]
      if (e.key === "[") {
        setBrushSize((s) => Math.max(s - 5, 5));
      } else if (e.key === "]") {
        setBrushSize((s) => Math.min(s + 5, 200));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Release space to go back to previous tool
      if (e.key === " ") {
        setTool("brush");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [onClose, handleUndo, handleRedo]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => Math.min(Math.max(z * delta, 0.1), 5));
    }
  }, []);

  const canvasStyle = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: "center center",
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <Overlay className="mask-modal-overlay" onClick={onClose}>
      <div className="mask-modal">
        {/* Header */}
        <Header
          title="Mask Editor"
          icon={<Brush size={18} />}
          iconVariant="default"
          onClose={onClose}
          className="mask-header-icon-pink"
        />

        {/* Toolbar */}
        <div className="mask-toolbar">
          <div className="mask-tool-group">
            <button
              className={`mask-tool-btn ${tool === "brush" ? "active" : ""}`}
              onClick={() => setTool("brush")}
              title="Brush (B)"
            >
              <Brush size={18} />
            </button>
            <button
              className={`mask-tool-btn ${tool === "eraser" ? "active" : ""}`}
              onClick={() => setTool("eraser")}
              title="Eraser (E)"
            >
              <Eraser size={18} />
            </button>
            <button
              className={`mask-tool-btn ${tool === "pan" ? "active" : ""}`}
              onClick={() => setTool("pan")}
              title="Pan (Space)"
            >
              <Move size={18} />
            </button>
          </div>

          <div className="mask-tool-divider" />

          <div className="mask-tool-group">
            <label className="mask-brush-size">
              <span>Size</span>
              <input
                type="range"
                min={5}
                max={200}
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
              />
              <span className="mask-brush-size-value">{brushSize}px</span>
            </label>
          </div>

          <div className="mask-tool-divider" />

          <div className="mask-tool-group">
            <button className="mask-tool-btn" onClick={handleZoomOut} title="Zoom Out">
              <ZoomOut size={18} />
            </button>
            <span className="mask-zoom-value">{Math.round(zoom * 100)}%</span>
            <button className="mask-tool-btn" onClick={handleZoomIn} title="Zoom In">
              <ZoomIn size={18} />
            </button>
            <button className="mask-tool-btn" onClick={handleZoomFit} title="Fit to View">
              <RotateCcw size={18} />
            </button>
          </div>

          <div className="mask-tool-divider" />

          <div className="mask-tool-group">
            <button
              className="mask-tool-btn"
              onClick={handleUndo}
              disabled={!undoState}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={18} />
            </button>
            <button
              className="mask-tool-btn"
              onClick={handleRedo}
              disabled={!redoState}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={18} />
            </button>
          </div>

          <div className="mask-tool-divider" />

          <button className="mask-clear-btn" onClick={handleClear}>
            Clear Mask
          </button>
        </div>

        {/* Canvas Area */}
        <div
          ref={containerRef}
          className="mask-canvas-container"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: tool === "pan" ? (isPanningRef.current ? "grabbing" : "grab") : "crosshair" }}
        >
          <div className="mask-canvas-wrapper" style={canvasStyle}>
            {/* Base image layer */}
            <canvas
              ref={baseCanvasRef}
              className="mask-canvas-base"
            />
            {/* Mask layer (semi-transparent overlay) */}
            <canvas
              ref={maskCanvasRef}
              className="mask-canvas-mask"
            />
            {/* Overlay layer for cursor preview */}
            <canvas
              ref={overlayCanvasRef}
              className="mask-canvas-overlay"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mask-footer">
          <div className="mask-footer-info">
            <span>
              Paint the mouth region. White = visible in final frames.
            </span>
          </div>
          <div className="mask-footer-actions">
            <button className="mask-cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button className="mask-save-btn" onClick={handleSave}>
              <Check size={16} />
              Save Mask
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  , document.body);
}

