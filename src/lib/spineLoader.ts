import { SkeletonBinaryReader } from "./skeletonBinaryReader";

export interface LoadedSpineFiles {
  skelFile: File | null;
  atlasFile: File;
  pngFiles: File[];
  version: string;
}

export async function loadSpineFileInputs(files: File[]): Promise<LoadedSpineFiles> {
  let skelFile: File | null = null;
  let atlasFile: File | null = null;
  const pngFiles: File[] = [];
  for (const file of files) {
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith(".skel") || fileName.endsWith(".skel.bytes")) {
      skelFile = file;
    } else if (fileName.endsWith(".atlas") || fileName.endsWith(".atlas.bytes") || fileName.endsWith(".atlas.txt")) {
      atlasFile = file;
    } else if (fileName.endsWith(".png")) {
      pngFiles.push(file);
    }
  }
  if (!skelFile) {
    throw new Error("Skel file is not found.");
  }
  if (!atlasFile) {
    throw new Error("Atlas file is not found.");
  }
  if (pngFiles.length === 0) {
    throw new Error("Png file is not found.");
  }
  const arrayBuffer = await skelFile.arrayBuffer();
  const version = getSpineVersion(arrayBuffer);
  const SPINE_VERSION_REGEX = /^4\.[12]\.\d+$/;
  if (!version || !SPINE_VERSION_REGEX.test(version)) {
    throw new Error(`Invalid or unsupported Spine version: ${version}`);
  }
  console.log("Spine version:", version);
  return {
    skelFile,
    atlasFile,
    pngFiles,
    version,
  };
}

export function getSpineVersion(buffer: ArrayBuffer | Uint8Array): string | null {
  const reader = new SkeletonBinaryReader(buffer);
  reader.skipBytes(8);
  return reader.readString();
}
