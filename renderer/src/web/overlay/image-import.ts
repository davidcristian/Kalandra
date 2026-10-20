import { ref } from "vue";
import type { ImageStripWidget } from "./widgets";

/** Adds a picked file to an image strip once main stores it, and keeps whether the last file failed. */
export function useImageImport(
  config: Pick<ImageStripWidget, "images">,
  importFile: (file: File) => Promise<string>,
) {
  const failed = ref(false);

  async function addImage(file: File) {
    failed.value = false;
    try {
      const name = await importFile(file);
      config.images.push({
        id: Math.max(0, ...config.images.map((_) => _.id)) + 1,
        url: name,
      });
    } catch (error) {
      failed.value = true;
      console.error("[image strip] Could not add the file:", error);
    }
  }

  return { failed, addImage };
}
