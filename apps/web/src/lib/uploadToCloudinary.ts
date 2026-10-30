// apps/web/src/lib/uploadToCloudinary.ts
import { apiClient } from "./api/client";

export type UploadKind = "image" | "video" | "audio" | "voice" | "file";

export interface CloudinaryUploadResult {
  url: string;
  kind: UploadKind;
  name: string;
  size: number;
  mimeType: string;
  duration?: number;
}

export function detectUploadKind(file: File): UploadKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "file";
}

/** Message `type` sent to backend for each upload kind */
export function kindToMessageType(kind: UploadKind): string {
  switch (kind) {
    case "image":
      return "IMAGE";
    case "video":
      return "VIDEO";
    case "audio":
    case "voice":
      return "VOICE_NOTE";
    default:
      return "FILE";
  }
}

/** Server endpoint per kind: POST /upload/:kind (signed with the Cloudinary API secret) */
const SERVER_KIND: Record<UploadKind, "image" | "video" | "audio" | "file"> = {
  image: "image",
  video: "video",
  audio: "audio",
  voice: "audio",
  file: "file",
};

/**
 * Uploads through our server, which signs the Cloudinary upload — so no unsigned
 * upload presets need to exist in the Cloudinary console.
 */
export async function uploadToCloudinary(
  file: File,
): Promise<CloudinaryUploadResult> {
  const kind = detectUploadKind(file);
  const formData = new FormData();
  formData.append("file", file);

  let data: { url?: string; duration?: number; message?: string };
  try {
    ({ data } = await apiClient.post(`/upload/${SERVER_KIND[kind]}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120_000,
    }));
  } catch (error: unknown) {
    const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
    throw new Error(message || (error as Error)?.message || "Upload failed", { cause: error });
  }

  if (!data?.url) throw new Error("Upload returned no file URL");

  // Local-storage fallback returns "/uploads/..."; load it from the API origin
  const url = data.url.startsWith("/")
    ? new URL(data.url, apiClient.defaults.baseURL || window.location.origin).toString()
    : data.url;

  return {
    url,
    kind,
    name: file.name,
    size: file.size,
    mimeType: file.type,
    duration: typeof data.duration === "number" ? data.duration : undefined,
  };
}