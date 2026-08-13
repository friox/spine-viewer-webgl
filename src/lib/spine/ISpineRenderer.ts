import type { LoadedSpineFiles } from "./spineLoader";

export interface SpineSlotInfo {
  name: string;
  visible: boolean;
  attachmentName: string | null;
}

export interface ISpineRenderer {
  // Initialization
  init(canvas: HTMLCanvasElement): Promise<void>;
  loadAssets(files: LoadedSpineFiles): Promise<void>;
  dispose(): void;
  isReady(): boolean;
  resize(width: number, height: number): void;
  renderSingleFrame?(delta?: number): void;
  
  // Animation Control
  play(): void;
  pause(): void;
  isPaused(): boolean;
  setTimeScale(speed: number): void;
  setAnimation(name: string, loop?: boolean, trackIndex?: number): void;
  getCurrentAnimation(): string | null;
  getAnimations(): string[];
  
  // Skin, Slot Control
  setSkin(name: string): void;
  getCurrentSkin(): string | null;
  getSkins(): string[];
  getSlots(activeSkinOnly?: boolean): SpineSlotInfo[];
  setSlotVisibility(slotName: string, visible: boolean): void;
  setAllSlotsVisibility(visible: boolean, targetSlotNames?: string[]): void;

  // Camera, Viewport
  setZoom(zoom: number): void;
  zoomAt(newZoom: number, mouseX?: number, mouseY?: number): void;
  pan(deltaX: number, deltaY: number): void;
  
  // Display, Overlay
  setPremultipliedAlpha(pma: boolean): void;
  setShowGuideline(show: boolean): void;
  setShowDebugBounds(show: boolean): void;
  setOverlayContext(ctx: CanvasRenderingContext2D | null): void;
  renderOverlay(ctx: CanvasRenderingContext2D, width: number, height: number): void;
  
  // Performance
  onFrameUpdate?: (fps: number, frameTimeMs: number) => void;

  // PNG Export
  exportPng(filename?: string): void;
}
