// apps/web/src/lib/uploadToCloudinary.ts

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

const PRESETS = {
  image:
    import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET_IMAGE ||
    "lingoverse_chat_images",
  video:
    import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET_VIDEO ||
    "lingoverse_chat_videos",
  audio:
    import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET_VOICE ||
    "lingoverse_voice_messages",
  voice:
    import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET_VOICE ||
    "lingoverse_voice_messages",
  file:
    import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET_FILE ||
    "lingoverse_chat_files",
};

export type UploadKind = keyof typeof PRESETS;

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

const RESOURCE_TYPE: Record<UploadKind, string> = {
  image: "image",
  video: "video",
  audio: "video", // Cloudinary treats audio as video resource
  voice: "video",
  file: "auto",
};

export async function uploadToCloudinary(
  file: File,
): Promise<CloudinaryUploadResult> {
  if (!CLOUDINARY_CLOUD_NAME) {
    throw new Error("Cloudinary cloud name is not configured");
  }

  const kind = detectUploadKind(file);
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", PRESETS[kind]);

  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${RESOURCE_TYPE[kind]}/upload`;

  const response = await fetch(url, { method: "POST", body: formData });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      err?.error?.message || `Upload failed (${response.status})`,
    );
  }

  const data = await response.json();

  return {
    url: data.secure_url,
    kind,
    name: file.name,
    size: file.size,
    mimeType: file.type,
    duration: typeof data.duration === "number" ? data.duration : undefined,
  };
}