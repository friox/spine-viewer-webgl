import type { ISpineRenderer } from "@/lib/spine/ISpineRenderer";
import { SpineFactory } from "@/lib/spine/SpineFactory";
import type { LoadedSpineFiles } from "@/lib/spine/spineLoader";
import { processSpineFiles } from "@/lib/spine/spineService";
import { useSpineStore } from "@/stores/useSpineStore";
import { RiFolderUploadLine } from "@remixicon/react";
import { useEffect, useRef, useState } from "react";

export function SpineCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<ISpineRenderer | null>(null);

  const { loadedSpineFiles } = useSpineStore();
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const fpsTextRef = useRef<HTMLParagraphElement>(null);

  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (!e.dataTransfer) return;

    const getFileFromEntry = async (fileEntry: FileSystemFileEntry): Promise<File> => {
      return new Promise((resolve, reject) => {
        fileEntry.file(resolve, reject);
      });
    };

    const readDirectoryEntries = async (dirEntry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> => {
      return new Promise((resolve) => {
        const dirReader = dirEntry.createReader();
        const entries: FileSystemEntry[] = [];

        const readBatch = () => {
          dirReader.readEntries((batch) => {
            if (batch.length === 0) {
              resolve(entries);
            } else {
              entries.push(...batch);
              readBatch();
            }
          });
        };

        readBatch();
      });
    };

    const files: File[] = [];
    const items = Array.from(e.dataTransfer.items || []);
    const entries: FileSystemEntry[] = [];

    for (const item of items) {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
        if (entry) entries.push(entry);
      }
    }

    const fileEntries = entries.filter((e): e is FileSystemFileEntry => e.isFile);
    const dirEntries = entries.filter((e): e is FileSystemDirectoryEntry => e.isDirectory);
    const directFilesPromise = Promise.all(fileEntries.map(getFileFromEntry));
    let dirFilesPromise: Promise<File[]> = Promise.resolve([]);

    if (dirEntries.length > 0) {
      dirEntries.sort((a, b) => a.name.localeCompare(b.name));
      const targetDir = dirEntries[0];
      const childEntries = await readDirectoryEntries(targetDir);
      const childFileEntries = childEntries.filter((e): e is FileSystemFileEntry => e.isFile);
      dirFilesPromise = Promise.all(childFileEntries.map(getFileFromEntry));
    }

    const [directFiles, dirFiles] = await Promise.all([directFilesPromise, dirFilesPromise]);
    files.push(...directFiles, ...dirFiles);
    
    processSpineFiles(files);
  };

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

  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!rendererRef.current) return;

      const mouseX = e.offsetX;
      const mouseY = e.offsetY;

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const currentZoom = useSpineStore.getState().zoom;
      const newZoom = Math.min(Math.max(0.1, currentZoom * zoomFactor), 5.0);

      rendererRef.current.zoomAt(newZoom, mouseX, mouseY);
      useSpineStore.setState({ zoom: newZoom });
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
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

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex-1 h-full overflow-hidden"
    >
      <canvas ref={canvasRef} className="w-full h-full block absolute inset-0 z-0" />
      <canvas
        ref={overlayCanvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="w-full h-full block absolute inset-0 z-10 cursor-grab active:cursor-grabbing touch-none select-none"
      />
      {isDragOver && (
        <div className="absolute inset-0 z-25 flex flex-col items-center justify-center bg-zinc-950/80 border-2 border-dashed border-primary pointer-events-none transition-all">
          <div className="flex flex-col items-center bg-card p-8 border">
            <RiFolderUploadLine className="w-16 h-16 text-primary" />
            <p className="mt-4 text-lg font-bold text-foreground">스파인 파일 또는 폴더를 여기에 드롭하세요</p>
            <p className="text-sm text-muted-foreground mt-1">.skel, .atlas, .png 파일들을 자동으로 감지합니다</p>
          </div>
        </div>
      )}
      <div className="absolute z-20 pointer-events-none flex left-4 bottom-4 bg-zinc-900/95 border border-zinc-800 px-3 py-1.5 text-xs">
        <p ref={fpsTextRef} className="text-zinc-400 font-mono">0 FPS / 0 ms</p>
      </div>
    </div>
  );
}
