import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { fromBase64, MAX_FILE_BYTES } from "./seal";

export const MAX_PHOTOS = 3;
export interface Photo { uri: string; bytes: Uint8Array }

// Progressively smaller settings until the photo fits the size limit.
const TRIES: Array<[number, number]> = [[960, 0.45], [720, 0.35], [540, 0.3], [420, 0.25]];

/** Re-encodes the picture as a small JPEG. Re-encoding writes a fresh file, which should carry no EXIF (GPS, phone model, time). */
async function shrink(uri: string): Promise<Photo> {
  for (const [width, compress] of TRIES) {
    const r = await manipulateAsync(uri, [{ resize: { width } }], { compress, format: SaveFormat.JPEG, base64: true });
    if (!r.base64) continue;
    const bytes = fromBase64(r.base64);
    if (bytes.length <= MAX_FILE_BYTES) return { uri: r.uri, bytes };
  }
  throw new Error("Photo too large");
}

export async function pickPhotos(max: number): Promise<Photo[]> {
  if (max <= 0) return [];
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: max, quality: 1, exif: false });
  if (res.canceled) return [];
  return Promise.all(res.assets.slice(0, max).map((a) => shrink(a.uri)));
}
