import { useState, useEffect, useRef, useCallback } from "react";
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";

export default function ImageViewer({ images, currentIndex, onClose }) {
  const [index, setIndex] = useState(currentIndex);
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const imgRef = useRef(null);
  const touchStart = useRef({ x: 0, y: 0 });
  const [swiping, setSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const current = images[index];

  const goNext = useCallback(() => {
    if (index < images.length - 1) { setIndex(i => i + 1); setZoom(1); setDrag({ x: 0, y: 0 }); }
  }, [index, images.length]);

  const goPrev = useCallback(() => {
    if (index > 0) { setIndex(i => i - 1); setZoom(1); setDrag({ x: 0, y: 0 }); }
  }, [index]);

  const toggleZoom = () => {
    setZoom(z => z === 1 ? 2 : 1);
    setDrag({ x: 0, y: 0 });
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "+" || e.key === "=") setZoom(z => Math.min(z + 0.5, 4));
      if (e.key === "-") setZoom(z => Math.max(z - 0.5, 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, goNext, goPrev]);

  const handleWheel = (e) => {
    e.preventDefault();
    setZoom(z => {
      const next = e.deltaY < 0 ? z + 0.2 : z - 0.2;
      return Math.max(1, Math.min(4, next));
    });
  };

  const handleMouseDown = (e) => {
    if (zoom > 1) {
      setDragging(true);
      dragStart.current = { x: e.clientX - drag.x, y: e.clientY - drag.y };
    }
  };

  const handleMouseMove = (e) => {
    if (dragging && zoom > 1) {
      setDrag({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    }
  };

  const handleMouseUp = () => setDragging(false);

  const handleTouchStart = (e) => {
    if (zoom > 1) return;
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setSwiping(true);
  };

  const handleTouchMove = (e) => {
    if (zoom > 1) return;
    const dx = e.touches[0].clientX - touchStart.current.x;
    setSwipeOffset(dx);
  };

  const handleTouchEnd = () => {
    if (zoom > 1) return;
    if (Math.abs(swipeOffset) > 60) {
      if (swipeOffset < 0) goNext();
      else goPrev();
    }
    setSwipeOffset(0);
    setSwiping(false);
  };

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 bg-black/95 z-[200] flex flex-col items-center justify-center select-none"
      onWheel={handleWheel}
    >
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button onClick={() => setZoom(z => Math.min(z + 0.5, 4))} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition" aria-label="Zoom in">
          <ZoomIn size={20} className="text-white" />
        </button>
        <button onClick={() => setZoom(z => Math.max(z - 0.5, 1))} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition" aria-label="Zoom out">
          <ZoomOut size={20} className="text-white" />
        </button>
        <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition" aria-label="Close">
          <X size={20} className="text-white" />
        </button>
      </div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm z-10">
        {index + 1} / {images.length}
      </div>

      {index > 0 && (
        <button onClick={goPrev} className="absolute left-4 z-10 p-3 bg-white/10 rounded-full hover:bg-white/20 transition" aria-label="Previous image">
          <ChevronLeft size={28} className="text-white" />
        </button>
      )}
      {index < images.length - 1 && (
        <button onClick={goNext} className="absolute right-4 z-10 p-3 bg-white/10 rounded-full hover:bg-white/20 transition" aria-label="Next image">
          <ChevronRight size={28} className="text-white" />
        </button>
      )}

      <div
        className="flex items-center justify-center w-full h-full overflow-hidden"
        style={{ cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          ref={imgRef}
          src={current.filename || current.src}
          alt={`Gallery ${index + 1}`}
          className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg transition-transform duration-200"
          style={{
            transform: `scale(${zoom}) translate(${drag.x / zoom}px, ${drag.y / zoom}px) translateX(${swipeOffset / zoom}px)`,
            transition: dragging || swiping ? "none" : "transform 0.2s ease",
          }}
          onDoubleClick={toggleZoom}
          draggable={false}
        />
      </div>
    </div>
  );
}
