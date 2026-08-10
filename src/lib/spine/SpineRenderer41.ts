import { useSpineStore } from "@/stores/useSpineStore";
import * as spine from "spine-webgl-4.1";
import type { LoadedSpineFiles } from "../spineLoader";
import type { ISpineRenderer, SpineSlotInfo } from "./ISpineRenderer";

export class SpineRenderer41 implements ISpineRenderer {
  // WebGL, Context
  private canvas!: HTMLCanvasElement;
  private context!: spine.ManagedWebGLRenderingContext;
  private sceneRenderer!: spine.SceneRenderer;
  private textures: spine.GLTexture[] = [];
  private initialized = false;
  private disposed = false;

  // Skeleton, Animation State
  private skeleton: spine.Skeleton | null = null;
  private animationState: spine.AnimationState | null = null;
  private paused: boolean = false;
  private timeScale: number = 1.0;

  // Camera, Viewport
  private baseWidth: number = 400;
  private baseHeight: number = 400;
  private zoom: number = 1.0;

  // Slot, Attachment
  private hiddenSlots: Set<string> = new Set();
  private hiddenSlotObjects: spine.Slot[] = [];
  private savedAttachments = new Map<string, spine.Attachment>();

  // Display, Overlay
  private premultipliedAlpha: boolean = true;
  private showGuideline: boolean = true;
  private showDebugBounds: boolean = false;
  private overlayCtx: CanvasRenderingContext2D | null = null;
  private overlayDirty: boolean = true;

  // Performance
  private animFrameId: number | null = null;
  private lastTime = Date.now();
  private frameCount = 0;
  private lastFpsTime = Date.now();
  onFrameUpdate?: (fps: number, frameTimeMs: number) => void;

  // ==============================
  // Initialization
  // ==============================
  async init(canvas: HTMLCanvasElement): Promise<void> {
    if (this.disposed) return;
    const contextAttributes: WebGLContextAttributes = {
      preserveDrawingBuffer: true,
      stencil: true,
    };
    this.canvas = canvas;
    this.context = new spine.ManagedWebGLRenderingContext(this.canvas, contextAttributes);
    this.sceneRenderer = new spine.SceneRenderer(this.canvas, this.context);
  }

  async loadAssets(files: LoadedSpineFiles): Promise<void> {
    if (this.disposed || !files.skelFile) return;

    const skelBuffer = await files.skelFile.arrayBuffer();
    const skelUint8Array = new Uint8Array(skelBuffer);
    const atlasText = await files.atlasFile.text();
    if (this.disposed) return;

    const atlas = new spine.TextureAtlas(atlasText);
    const pma = atlas.pages[0]?.pma ?? true;
    this.premultipliedAlpha = pma;
    useSpineStore.setState({ premultipliedAlpha: pma });

    const textureMap = new Map<string, spine.GLTexture>();
    for (const page of atlas.pages) {
      const pageNameLower = page.name.toLowerCase();
      const pngFile = files.pngFiles.find((f) => f.name.toLowerCase() === pageNameLower);
      if (!pngFile) {
        throw new Error(`SpineRenderer41: png file not found for ${page.name}`);
      }
      let tempBitmap = await createImageBitmap(pngFile, { premultiplyAlpha: "none" });
      let finalBitmap = tempBitmap;
      if (page.width > 0 && page.height > 0 && (tempBitmap.width !== page.width || tempBitmap.height !== page.height)) {
        tempBitmap.close();
        finalBitmap = await createImageBitmap(pngFile, {
          premultiplyAlpha: "none",
          resizeWidth: page.width,
          resizeHeight: page.height,
          resizeQuality: "high",
        });
      }
      const glTexture = new spine.GLTexture(this.context, finalBitmap);
      this.textures.push(glTexture);
      page.setTexture(glTexture);
    }

    for (const pngFile of files.pngFiles) {
      const imageBitmap = await createImageBitmap(pngFile, { premultiplyAlpha: "none" });
      if (this.disposed) {
        imageBitmap.close();
        return;
      }
      const glTexture = new spine.GLTexture(this.context, imageBitmap);
      this.textures.push(glTexture);
      textureMap.set(pngFile.name.toLowerCase(), glTexture);
    }

    const atlasLoader = new spine.AtlasAttachmentLoader(atlas);
    const skeletonBinary = new spine.SkeletonBinary(atlasLoader);
    const skeletonData = skeletonBinary.readSkeletonData(skelUint8Array);
    
    this.skeleton = new spine.Skeleton(skeletonData);
    const stateData = new spine.AnimationStateData(skeletonData);
    stateData.defaultMix = 0.2;
    this.animationState = new spine.AnimationState(stateData);
    this.animationState.timeScale = this.timeScale;

    // Skin
    if (skeletonData.skins.length > 0) {
      const sortedSkins = [...skeletonData.skins].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
      );
      const targetSkin =
        sortedSkins.find((s) => s.name.toLowerCase() === "normal") ||
        sortedSkins.find((s) => s.name !== "default") ||
        sortedSkins[0];
      if (targetSkin) this.skeleton.setSkin(targetSkin);
    }
    this.skeleton.setToSetupPose();
    
    // Animation
    if (skeletonData.animations.length > 0) {
      const sortedAnims = [...skeletonData.animations]
      .map((a) => a.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
      const targetAnim = sortedAnims.find((a) => a.toLowerCase() === "idle_1") || sortedAnims[0]; // trickcal
      this.animationState.setAnimation(0, targetAnim, true);
    }
    
    this.hiddenSlots.clear();
    this.updateHiddenSlotObjects();
    this.animationState.apply(this.skeleton);
    this.applySlotVisibilities();
    this.skeleton.updateWorldTransform();
    this.setupCamera(skeletonData);
    this.initialized = true;
    this.startRenderLoop();
  }

  dispose(): void {
    this.disposed = true;
    this.initialized = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.textures.forEach((texture) => {
      try {
        texture.dispose();
      } catch (e) {
        console.warn("texture dispose warning:", e);
      }
    });
    this.textures = [];
    try {
      this.sceneRenderer?.dispose();
    } catch (e) {
      console.warn("scene renderer dispose warning:", e);
    }
    this.skeleton = null;
    this.animationState = null;
  }

  isReady(): boolean {
    return this.initialized && !this.disposed;
  }

  resize(width: number, height: number): void {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const newWidth = Math.floor(width * dpr);
    const newHeight = Math.floor(height * dpr);
    if (this.canvas.width !== newWidth || this.canvas.height !== newHeight) {
      this.canvas.width = newWidth;
      this.canvas.height = newHeight;
      if (this.sceneRenderer?.camera) this.updateCameraViewport();
      this.renderSingleFrame(0);
    }
  }

  public renderSingleFrame(delta = 0): void {
    if (this.disposed || !this.canvas || !this.context) return;
    const gl = this.context.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (this.skeleton && this.animationState) {
      if (!this.paused && delta > 0) {
        this.animationState.update(delta);
        this.animationState.apply(this.skeleton);
        this.applySlotVisibilities();
        this.skeleton.updateWorldTransform();
      }
      this.sceneRenderer.begin();
      this.sceneRenderer.drawSkeleton(this.skeleton, this.premultipliedAlpha);
      this.sceneRenderer.end();
      if (this.showDebugBounds) this.overlayDirty = true;
      if (this.overlayCtx && this.canvas) {
        this.renderOverlay(this.overlayCtx, this.canvas.clientWidth, this.canvas.clientHeight);
        this.overlayDirty = false;
      }
    }
  }

  // ==============================
  // Animation Control
  // ==============================
  play(): void {
    this.paused = false;
  }

  pause(): void {
    this.paused = true;
  }

  isPaused(): boolean {
    return this.paused;
  }

  setTimeScale(speed: number): void {
    this.timeScale = Math.max(0, speed);
    if (this.animationState) this.animationState.timeScale = this.timeScale;
  }

  setAnimation(name: string, loop = true, trackIndex = 0): void {
    if (!this.initialized || this.disposed || !this.animationState || !this.skeleton) return;
    this.animationState.setAnimation(trackIndex, name, loop);
    this.animationState.apply(this.skeleton);
    this.applySlotVisibilities();
    this.skeleton.updateWorldTransform();
  }

  getCurrentAnimation(): string | null {
    if (!this.initialized || !this.animationState) return null;
    const currentTrack = this.animationState.getCurrent(0);
    return currentTrack?.animation?.name ?? null;
  }

  getAnimations(): string[] {
    if (!this.initialized || !this.skeleton) return [];
    return this.skeleton.data.animations.map((a) => a.name);
  }

  // ==============================
  // Skin, Slot Control
  // ==============================
  setSkin(name: string): void {
    if (!this.initialized || this.disposed || !this.skeleton) return;
    this.skeleton.setSkinByName(name);
    this.skeleton.setSlotsToSetupPose();
    if (this.animationState) this.animationState.apply(this.skeleton);
    this.applySlotVisibilities();
    this.skeleton.updateWorldTransform();
  }

  getCurrentSkin(): string | null {
    if (!this.initialized || !this.skeleton) return null;
    return this.skeleton.skin?.name ?? null;
  }

  getSkins(): string[] {
    if (!this.initialized || !this.skeleton) return [];
    return this.skeleton.data.skins.map((s) => s.name);
  }

  getSlots(activeSkinOnly = false): SpineSlotInfo[] {
    if (!this.initialized || !this.skeleton) return [];
    const slots = this.skeleton.slots;
    const result: SpineSlotInfo[] = [];
    const timelineActiveSlots = new Set<number>();
    const timelineFallbackNames = new Map<number, string>();
    if (activeSkinOnly && this.animationState) {
      const currentTrack = this.animationState.getCurrent(0);
      if (currentTrack && currentTrack.animation) {
        for (const timeline of currentTrack.animation.timelines) {
          const anyTl = timeline as any;
          if (anyTl.slotIndex !== undefined && anyTl.attachmentNames !== undefined) {
            timelineActiveSlots.add(anyTl.slotIndex);
            const names: string[] = anyTl.attachmentNames;
            for (const name of names) {
              if (name) {
                timelineFallbackNames.set(anyTl.slotIndex, name);
                break;
              }
            }
          }
        }
      }
    }
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const slotName = slot.data.name;
      const slotIndex = slot.data.index;
      const isHiddenByUser = this.hiddenSlots.has(slotName);
      const activeAtt = slot.getAttachment() || this.savedAttachments.get(slotName);
      const setupAttName = slot.data.attachmentName;
      const timelineFallbackName = timelineFallbackNames.get(slotIndex);
      const isValidPart =
        (activeAtt !== undefined && activeAtt !== null) || setupAttName !== null || timelineActiveSlots.has(slotIndex);
      const attachmentName = (activeAtt ? activeAtt.name : (setupAttName || timelineFallbackName)) ?? null;
      if (activeSkinOnly) {
        if (!isValidPart) continue;
        result.push({
          name: slotName,
          visible: !isHiddenByUser,
          attachmentName: attachmentName,
        });
      } else {
        result.push({
          name: slotName,
          visible: !isHiddenByUser,
          attachmentName: isValidPart ? attachmentName : null,
        });
      }
    }
    return result;
  }

  setSlotVisibility(slotName: string, visible: boolean): void {
    if (!this.initialized || !this.skeleton) return;
    const slot = this.skeleton.findSlot(slotName);
    if (!visible) {
      if (slot && slot.getAttachment()) {
        this.savedAttachments.set(slotName, slot.getAttachment()!);
      }
      this.hiddenSlots.add(slotName);
    } else {
      this.hiddenSlots.delete(slotName);
      if (slot) {
        const saved = this.savedAttachments.get(slotName);
        if (saved) {
          slot.setAttachment(saved);
          this.savedAttachments.delete(slotName);
        } else if (slot.data.attachmentName) {
          try {
            this.skeleton.setAttachment(slot.data.name, slot.data.attachmentName);
          } catch (e) {}
        } else if (this.skeleton.skin) {
          const skinAtt = this.skeleton.skin.getAttachment(slot.data.index, slot.data.name);
          if (skinAtt) slot.setAttachment(skinAtt);
        }
      }
    }
    this.updateHiddenSlotObjects();
    if (this.animationState) {
      this.animationState.apply(this.skeleton);
      this.applySlotVisibilities();
      this.skeleton.updateWorldTransform();
      this.overlayDirty = true;
    }
  }

  setAllSlotsVisibility(visible: boolean, targetSlotNames?: string[]): void {
    if (!this.initialized || !this.skeleton) return;
    const slotsToProcess = targetSlotNames
      ? targetSlotNames.map((name) => this.skeleton!.findSlot(name)).filter((s) => s !== null)
      : this.skeleton.slots;
    if (visible) {
      slotsToProcess.forEach((slot) => {
        const slotName = slot.data.name;
        this.hiddenSlots.delete(slotName);
        const saved = this.savedAttachments.get(slotName);
        if (saved) {
          slot.setAttachment(saved);
          this.savedAttachments.delete(slotName);
        } else if (slot.data.attachmentName) {
          try {
            this.skeleton!.setAttachment(slot.data.name, slot.data.attachmentName);
          } catch (e) {}
        }
      });
    } else {
      slotsToProcess.forEach((slot) => {
        const slotName = slot.data.name;
        if (!this.hiddenSlots.has(slotName)) {
          const att = slot.getAttachment();
          if (att) this.savedAttachments.set(slotName, att);
          this.hiddenSlots.add(slotName);
        }
      });
    }
    this.updateHiddenSlotObjects();
    if (this.animationState) {
      this.animationState.apply(this.skeleton);
      this.applySlotVisibilities();
      this.skeleton.updateWorldTransform();
      this.overlayDirty = true;
    }
  }

  // ==============================
  // Camera, Viewport
  // ==============================
  setZoom(zoom: number): void {
    this.zoomAt(zoom);
  }

  zoomAt(newZoom: number, mouseX?: number, mouseY?: number): void {
    if (!this.sceneRenderer?.camera || !this.canvas) return;
    const camera = this.sceneRenderer.camera;
    const canvasWidth = this.canvas.clientWidth || 1;
    const canvasHeight = this.canvas.clientHeight || 1;
    const targetZoom = Math.min(Math.max(0.1, newZoom), 5.0);
    if (mouseX !== undefined && mouseY !== undefined) {
      const screenDX = mouseX - canvasWidth / 2;
      const screenDY = mouseY - canvasHeight / 2;
      const oldWorldPerPixelX = camera.viewportWidth / canvasWidth;
      const oldWorldPerPixelY = camera.viewportHeight / canvasHeight;
      this.zoom = targetZoom;
      this.updateCameraViewport();
      const newWorldPerPixelX = camera.viewportWidth / canvasWidth;
      const newWorldPerPixelY = camera.viewportHeight / canvasHeight;
      camera.position.x += screenDX * (oldWorldPerPixelX - newWorldPerPixelX);
      camera.position.y -= screenDY * (oldWorldPerPixelY - newWorldPerPixelY);
      camera.update();
    } else {
      this.zoom = targetZoom;
      this.updateCameraViewport();
    }
    this.overlayDirty = true;
  }

  pan(deltaX: number, deltaY: number): void {
    if (!this.sceneRenderer?.camera || !this.canvas) return;
    const camera = this.sceneRenderer.camera;
    const canvasWidth = this.canvas.clientWidth || 1;
    const canvasHeight = this.canvas.clientHeight || 1;
    const worldDeltaX = deltaX * (camera.viewportWidth / canvasWidth);
    const worldDeltaY = deltaY * (camera.viewportHeight / canvasHeight);
    camera.position.x -= worldDeltaX;
    camera.position.y += worldDeltaY;
    camera.update();
    this.overlayDirty = true;
  }

  // ==============================
  // Display, Overlay
  // ==============================
  setPremultipliedAlpha(pma: boolean): void {
    this.premultipliedAlpha = pma;
  }

  setShowGuideline(show: boolean): void {
    this.showGuideline = show;
    this.overlayDirty = true;
  }

  setShowDebugBounds(show: boolean): void {
    this.showDebugBounds = show;
    this.overlayDirty = true;
  }

  setOverlayContext(ctx: CanvasRenderingContext2D | null): void {
    this.overlayCtx = ctx;
    this.overlayDirty = true;
  }

  renderOverlay(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.clearRect(0, 0, width, height);
    if (!this.sceneRenderer?.camera) return;
    const camera = this.sceneRenderer.camera;
    const screenCenterX = width / 2;
    const screenCenterY = height / 2;
    if (this.showGuideline) {
      const originScreenX = screenCenterX + -camera.position.x * (width / camera.viewportWidth);
      const originScreenY = screenCenterY - -camera.position.y * (height / camera.viewportHeight);

      ctx.save();
      ctx.lineWidth = 1.5;

      // X축 (빨강)
      ctx.beginPath();
      ctx.strokeStyle = "#EF4444D9";
      ctx.moveTo(0, originScreenY);
      ctx.lineTo(width, originScreenY);
      ctx.stroke();

      // Y축 (초록)
      ctx.beginPath();
      ctx.strokeStyle = "#22C55ED9";
      ctx.moveTo(originScreenX, 0);
      ctx.lineTo(originScreenX, height);
      ctx.stroke();

      // 원점
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(originScreenX, originScreenY, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    if (this.showDebugBounds && this.skeleton) {
      const offset = new spine.Vector2();
      const size = new spine.Vector2();
      this.skeleton.getBounds(offset, size);
      const minX = screenCenterX + (offset.x - camera.position.x) * (width / camera.viewportWidth);
      const maxY = screenCenterY - (offset.y + size.y - camera.position.y) * (height / camera.viewportHeight);
      const boxWidth = size.x * (width / camera.viewportWidth);
      const boxHeight = size.y * (height / camera.viewportHeight);

      ctx.save();
      ctx.strokeStyle = "#3B82F6E6"; // 파랑
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(minX, maxY, boxWidth, boxHeight);
      ctx.fillStyle = "#60A5FA";
      ctx.font = "11px sans-serif";
      ctx.fillText(`${Math.round(size.x)} x ${Math.round(size.y)}`, minX + 4, maxY - 6);
      ctx.restore();
    }
  }
  
  private setupCamera(skeletonData: spine.SkeletonData): void {
    if (!this.sceneRenderer?.camera) return;
    this.baseWidth = skeletonData.width || 400;
    this.baseHeight = skeletonData.height || 400;
    const x = skeletonData.x || -this.baseWidth / 2;
    const y = skeletonData.y || -this.baseHeight / 2;
    this.sceneRenderer.camera.position.x = x + this.baseWidth / 2;
    this.sceneRenderer.camera.position.y = y + this.baseHeight / 2;
    this.updateCameraViewport();
  }

  private updateCameraViewport(): void {
    if (!this.sceneRenderer?.camera || !this.canvas) return;
    this.sceneRenderer.resize(spine.ResizeMode.Expand);
    if (this.sceneRenderer.camera) {
      const camera = this.sceneRenderer.camera;
      camera.viewportWidth /= this.zoom;
      camera.viewportHeight /= this.zoom;
      camera.update();
    }
  }

  private updateHiddenSlotObjects(): void {
    if (!this.skeleton) {
      this.hiddenSlotObjects = [];
      return;
    }
    const slots: spine.Slot[] = [];
    this.hiddenSlots.forEach((name) => {
      const slot = this.skeleton!.findSlot(name);
      if (slot) slots.push(slot);
    });
    this.hiddenSlotObjects = slots;
    this.overlayDirty = true;
  }

  private applySlotVisibilities(): void {
    for (let i = 0; i < this.hiddenSlotObjects.length; i++) {
      this.hiddenSlotObjects[i].setAttachment(null);
    }
  }

  private startRenderLoop(): void {
    const render = () => {
      if (this.disposed) return;
      const now = Date.now();
      const delta = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const gl = this.context.gl;
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (this.skeleton && this.animationState) {
        if (!this.paused) {
          this.animationState.update(delta);
          this.animationState.apply(this.skeleton);
          this.applySlotVisibilities();
          this.skeleton.updateWorldTransform();
        }
        if (this.sceneRenderer) {
          const drawStart = performance.now();
          this.sceneRenderer.begin();
          this.sceneRenderer.drawSkeleton(this.skeleton, this.premultipliedAlpha);
          this.sceneRenderer.end();
          const renderTimeMs = performance.now() - drawStart;
          this.frameCount++;
          if (now - this.lastFpsTime >= 500) {
            const fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
            if (this.onFrameUpdate) this.onFrameUpdate(fps, renderTimeMs);
            this.frameCount = 0;
            this.lastFpsTime = now;
          }
        }
        if (this.showDebugBounds) this.overlayDirty = true;
        if (this.overlayDirty && this.overlayCtx && this.canvas) {
          this.renderOverlay(this.overlayCtx, this.canvas.clientWidth, this.canvas.clientHeight);
          this.overlayDirty = false;
        }
      }
      this.animFrameId = requestAnimationFrame(render);
    };
    this.lastTime = Date.now();
    render();
  }
}
