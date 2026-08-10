import type { ISpineRenderer } from "@/lib/spine/ISpineRenderer";
import { SpineFactory } from "@/lib/spine/SpineFactory";
import type { LoadedSpineFiles } from "@/lib/spineLoader";
import { useSpineStore } from "@/stores/useSpineStore";
import { useEffect, useRef } from "react";

export function SpineCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<ISpineRenderer | null>(null);

  const { zoom, loadedSpineFiles } = useSpineStore();
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const fpsTextRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const spineFiles = loadedSpineFiles;

    if (!canvas || !spineFiles) return;
    let isCancelled = false;

    async function initAndLoadSpine(targetCanvas: HTMLCanvasElement, files: LoadedSpineFiles) {
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }

      try {
        const renderer = SpineFactory.createRenderer(files.version);
        renderer.onFrameUpdate = (fps, frameTime) => {
          if (fpsTextRef.current) {
            fpsTextRef.current.innerText = `${fps} FPS / ${frameTime.toFixed(1)} ms`;
          }
        };
        await renderer.init(targetCanvas);
        if (isCancelled) {
          renderer.dispose();
          return;
        }
        await renderer.loadAssets(files);
        if (isCancelled) {
          renderer.dispose();
          return;
        }
        rendererRef.current = renderer;

        if (overlayCanvasRef.current) {
          const overlayCtx = overlayCanvasRef.current.getContext("2d");
          renderer.setOverlayContext(overlayCtx);
        }

        useSpineStore.getState().setRenderer(renderer);

        const { zoom, showGuideline } = useSpineStore.getState();
        renderer.setZoom(zoom);
        renderer.setShowGuideline(showGuideline);

        if (containerRef.current) {
          const { clientWidth, clientHeight } = containerRef.current;
          renderer.resize(clientWidth, clientHeight);
        }
      } catch (e) {
        console.error("initAndLoadSpine error", e);
      }
    }

    initAndLoadSpine(canvas, spineFiles);

    return () => {
      isCancelled = true;
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
        useSpineStore.getState().setRenderer(null);
      }
    };
  }, [loadedSpineFiles]);

  useEffect(() => {
    if (!containerRef.current || !overlayCanvasRef.current) return;
    const overlayCanvas = overlayCanvasRef.current;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        const targetW = Math.floor(width * dpr);
        const targetH = Math.floor(height * dpr);
        if (targetW > 0 && targetH > 0) {
          if (overlayCanvas.width !== targetW || overlayCanvas.height !== targetH) {
            overlayCanvas.width = targetW;
            overlayCanvas.height = targetH;
          }

          if (rendererRef.current) {
            rendererRef.current.resize(width, height);
            const overlayCtx = overlayCanvas.getContext("2d");
            rendererRef.current.setOverlayContext(overlayCtx);
          }
        }
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || !rendererRef.current) return;
    const deltaX = e.clientX - lastMousePosRef.current.x;
    const deltaY = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    rendererRef.current.pan(deltaX, deltaY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!rendererRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(0.1, zoom * zoomFactor), 5.0);
    rendererRef.current.zoomAt(newZoom, mouseX, mouseY);
    useSpineStore.setState({ zoom: newZoom });
  };

  return (
    <div ref={containerRef} className="relative flex-1 h-full overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block absolute inset-0 z-0" />
      <canvas
        ref={overlayCanvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        className="w-full h-full block absolute inset-0 z-10 cursor-grab active:cursor-grabbing touch-none select-none"
      />
      <div className="absolute z-20 pointer-events-none flex left-4 bottom-4 bg-zinc-900/95 border border-zinc-800 px-3 py-1.5 text-xs">
        <p ref={fpsTextRef} className="text-zinc-400 font-mono">0 FPS / 0 ms</p>
      </div>
    </div>
  );
}
