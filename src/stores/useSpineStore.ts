import type { ISpineRenderer, SpineSlotInfo } from "@/lib/spine/ISpineRenderer";
import type { LoadedSpineFiles } from "@/lib/spine/spineLoader";
import { create } from "zustand";

export interface SpineStateValues {
  loadedSpineFiles: LoadedSpineFiles | null;
  renderer: ISpineRenderer | null;
  isPlaying: boolean;
  timeScale: number;
  animations: string[];
  skins: string[];
  currentAnimation: string | null;
  currentSkin: string | null;
  slots: SpineSlotInfo[];
  activeSkinOnlySlots: boolean;
  zoom: number;
  showGuideline: boolean;
  premultipliedAlpha: boolean;
  showDebugBounds: boolean;
}

export interface SpineActions {
  setLoadedSpineFiles: (files: LoadedSpineFiles) => void;
  setRenderer: (renderer: ISpineRenderer | null) => void;

  setIsPlaying: (playing: boolean) => void;
  setTimeScale: (speed: number) => void;

  setAnimation: (name: string) => void;
  setSkin: (name: string) => void;

  setSlotVisibility: (slotName: string, visible: boolean) => void;
  setAllSlotsVisibility: (visible: boolean, customTargetNames?: string[]) => void;
  setActiveSkinOnlySlots: (activeOnly: boolean) => void;

  setZoom: (zoom: number) => void;
  setShowGuideline: (show: boolean) => void;
  setPremultipliedAlpha: (pma: boolean) => void;
  setShowDebugBounds: (show: boolean) => void;

  exportPng: (filename?: string) => void;
}

export type SpineState = SpineStateValues & SpineActions;

export const useSpineStore = create<SpineState>((set, get) => {
  const syncSlots = (renderer: ISpineRenderer | null, activeOnly?: boolean) => {
    if (!renderer) return;
    const filterState = activeOnly ?? get().activeSkinOnlySlots;
    set({ slots: renderer.getSlots(filterState) });
  };

  return {
    loadedSpineFiles: null,
    renderer: null,

    isPlaying: true,
    timeScale: 1.0,

    animations: [],
    skins: [],
    currentAnimation: null,
    currentSkin: null,

    slots: [],
    activeSkinOnlySlots: true,

    zoom: 1.0,
    showGuideline: true,
    premultipliedAlpha: true,
    showDebugBounds: false,

    setLoadedSpineFiles: (files) => set({ loadedSpineFiles: files }),

    setRenderer: (renderer) => {
      set({ renderer });

      if (renderer) {
        const {
          isPlaying,
          timeScale,
          zoom,
          showGuideline,
          activeSkinOnlySlots,
          premultipliedAlpha,
          showDebugBounds,
        } = get();

        if (isPlaying) renderer.play();
        else renderer.pause();

        renderer.setTimeScale(timeScale);
        renderer.setZoom(zoom);
        renderer.setShowGuideline(showGuideline);
        renderer.setPremultipliedAlpha(premultipliedAlpha);
        renderer.setShowDebugBounds(showDebugBounds);

        set({
          animations: renderer.getAnimations(),
          skins: renderer.getSkins(),
          currentAnimation: renderer.getCurrentAnimation(),
          currentSkin: renderer.getCurrentSkin(),
          slots: renderer.getSlots(activeSkinOnlySlots),
        });
      } else {
        set({
          animations: [],
          skins: [],
          currentAnimation: null,
          currentSkin: null,
          slots: [],
        });
      }
    },

    setIsPlaying: (playing) => {
      const { renderer } = get();
      set({ isPlaying: playing });
      if (playing) renderer?.play();
      else renderer?.pause();
    },

    setTimeScale: (speed) => {
      const { renderer } = get();
      set({ timeScale: speed });
      renderer?.setTimeScale(speed);
    },

    setAnimation: (name) => {
      const { renderer } = get();
      set({ currentAnimation: name });
      renderer?.setAnimation(name);
      syncSlots(renderer);
    },

    setSkin: (name) => {
      const { renderer } = get();
      set({ currentSkin: name });
      renderer?.setSkin(name);
      syncSlots(renderer);
    },

    setSlotVisibility: (slotName, visible) => {
      const { renderer } = get();
      renderer?.setSlotVisibility(slotName, visible);
      syncSlots(renderer);
    },

    setAllSlotsVisibility: (visible, customTargetNames) => {
      const { renderer, slots } = get();
      if (renderer) {
        const targetNames = customTargetNames || slots.map((s) => s.name);
        renderer.setAllSlotsVisibility(visible, targetNames);
        syncSlots(renderer);
      }
    },

    setActiveSkinOnlySlots: (activeOnly) => {
      const { renderer } = get();
      set({ activeSkinOnlySlots: activeOnly });
      syncSlots(renderer, activeOnly);
    },

    setZoom: (zoom) => {
      const { renderer } = get();
      set({ zoom });
      renderer?.setZoom(zoom);
    },

    setShowGuideline: (show) => {
      const { renderer } = get();
      set({ showGuideline: show });
      renderer?.setShowGuideline(show);
    },

    setPremultipliedAlpha: (pma) => {
      const { renderer } = get();
      set({ premultipliedAlpha: pma });
      renderer?.setPremultipliedAlpha(pma);
    },

    setShowDebugBounds: (show) => {
      const { renderer } = get();
      set({ showDebugBounds: show });
      renderer?.setShowDebugBounds(show);
    },

    exportPng: (filename) => {
      const { renderer } = get();
      renderer?.exportPng(filename);
    }
  };
});
