import { useSpineStore } from "@/stores/useSpineStore";
import { loadSpineFileInputs } from "./spineLoader";

export async function processSpineFiles(files: File[]) {
  const store = useSpineStore.getState();
  try {
    const loadedFiles = await loadSpineFileInputs(files);
    store.setLoadedSpineFiles(loadedFiles);
    console.log(loadedFiles);
  } catch (error) {
    console.error("Failed to load spine files:", error);
  }
}
