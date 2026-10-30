// apps/web/src/components/chat/MessageInput.tsx
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";
import type { AlbumAttachment } from "../../hooks/useChat";
import { getDraft, setDraft } from "../../lib/chatDrafts";
import { ScheduleDialog } from "./ChatDialogs";
import {
  Send,
  Image as ImageIcon,
  Smile,
  X,
  Loader2,
  Mic,
  MicOff,
  Check,
  Edit,
  // Renamed: a lucide "File" import shadowed the browser File constructor used for voice uploads
  File as FileIcon,
  Video,
  Music,
  MapPin,
  Clock,
  Play,
  Pause,
  Trash2,
  Sticker,
  Plus,
  CalendarClock,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { apiClient } from "../../lib/api/client";

interface MessageInputProps {
  onSend: (
    content: string,
    type?: string,
    mediaUrl?: string,
    fileUrl?: string,
    /**
     * Voice notes: recorded length in seconds (WebM files often don't store it).
     * Files: original name, size and mime type, shown on the file card.
     * Photos/videos: view-once, or several sent together as an album.
     */
    extra?: SendExtra,
  ) => void;
  /** Unsent text is kept per chat under this key */
  draftKey?: string;
  /** Group members for @mention suggestions */
  mentionCandidates?: Array<{ id: string; name: string }>;
  /** Schedule the typed text; resolves true when it was scheduled */
  onSchedule?: (content: string, sendAt: Date) => Promise<boolean>;
  onTyping?: (isTyping: boolean) => void;
  onVoiceRecording?: (blob: Blob, duration: number) => void;
  editingMessage?: { id: string; content: string } | null;
  onCancelEdit?: () => void;
  isConnected?: boolean;
  onEmojiPickerToggle?: () => void;
  onSelectMessages?: () => void;
  isSelectionMode?: boolean;
  isRecording?: boolean;
  recordingDuration?: number;
}

export interface SendExtra {
  duration?: number;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  isViewOnce?: boolean;
  attachments?: AlbumAttachment[];
}

/** Lets the chat window hand over files dropped anywhere on it */
export interface MessageInputHandle {
  addFiles: (files: File[]) => void;
}

/** One photo/video of an album being uploaded */
interface AlbumItem {
  id: string;
  file: File;
  localUrl: string;
  kind: "IMAGE" | "VIDEO";
  progress: number;
  url?: string;
  failed?: boolean;
}

const MAX_ALBUM = 10;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const DOC_EXTENSIONS = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|txt|csv)$/i;

const BAR_COUNT = 32;

/**
 * Uploads go through our server (POST /upload/:kind), which signs them with the
 * Cloudinary API secret — no unsigned upload presets needed in the Cloudinary console.
 * Documents are stored as "raw" so PDFs always download.
 */
const SERVER_UPLOAD_KIND: Record<string, "image" | "video" | "audio" | "file"> = {
  image: "image",
  video: "video",
  audio: "audio",
  voice: "audio",
  file: "file",
};

/** The server's local-storage fallback returns "/uploads/..."; serve it from the API origin */
const toAbsoluteUploadUrl = (url: string) => {
  if (!url.startsWith("/")) return url;
  try {
    return new URL(url, apiClient.defaults.baseURL || window.location.origin).toString();
  } catch {
    return url;
  }
};

export const MessageInput = forwardRef<MessageInputHandle, MessageInputProps>(function MessageInput({
  onSend,
  onTyping,
  editingMessage = null,
  onCancelEdit,
  isConnected = true,
  onEmojiPickerToggle,
  isSelectionMode = false,
  draftKey,
  mentionCandidates,
  onSchedule,
}, ref) {
  const [content, setContent] = useState(() => (draftKey ? getDraft(draftKey) : ""));
  const [isUploading, setIsUploading] = useState(false);
  /** 0–1 while a single attachment uploads */
  const [uploadProgress, setUploadProgress] = useState(0);
  const [album, setAlbum] = useState<AlbumItem[]>([]);
  /** Next photo/video is view-once */
  const [viewOnce, setViewOnce] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mediaPreview, setMediaPreview] = useState<{
    url: string;
    type: "image" | "video" | "audio" | "file";
    name?: string;
  } | null>(null);
  const [fileAttachment, setFileAttachment] = useState<{
    name: string;
    url: string;
    size?: number;
    type?: string;
  } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isTypingState, setIsTypingState] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>(
    Array(BAR_COUNT).fill(0.08),
  );
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingDurationRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const smoothLevelsRef = useRef<number[]>(Array(BAR_COUNT).fill(0.08));

  const getSupportedMimeType = () => {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];
    for (const type of types) {
      if (
        typeof MediaRecorder !== "undefined" &&
        MediaRecorder.isTypeSupported(type)
      ) {
        return type;
      }
    }
    return "";
  };

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const clearRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const stopVisualizer = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    smoothLevelsRef.current = Array(BAR_COUNT).fill(0.08);
    setAudioLevels(Array(BAR_COUNT).fill(0.08));
  }, []);

  const startVisualizer = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.85;
      source.connect(analyser);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const usable = Math.floor(data.length * 0.5);

      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);

        const next: number[] = [];
        for (let i = 0; i < BAR_COUNT; i++) {
          const idx = Math.floor((i / BAR_COUNT) * usable);
          const raw = Math.pow((data[idx] || 0) / 255, 0.65);
          next.push(Math.max(0.06, Math.min(1, raw)));
        }

        const prev = smoothLevelsRef.current;
        const smoothed = next.map((v, i) => {
          const p = prev[i] ?? 0.08;
          return p + (v - p) * 0.3;
        });
        smoothLevelsRef.current = smoothed;
        setAudioLevels([...smoothed]);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* visualizer optional */
    }
  }, []);

  /** Uploads via our server (signed Cloudinary upload); returns the public URL or null */
  const uploadToCloudinary = useCallback(
    async (file: File, type: string, onProgress?: (fraction: number) => void): Promise<string | null> => {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const kind = SERVER_UPLOAD_KIND[type] ?? "file";
        const { data } = await apiClient.post<{ url?: string }>(`/upload/${kind}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 120_000,
          onUploadProgress: (e) => onProgress?.(e.total ? e.loaded / e.total : 0),
        });

        if (!data?.url) throw new Error("Upload returned no file URL");
        return toAbsoluteUploadUrl(data.url);
      } catch (error: any) {
        console.error(`Upload error (${type}):`, error);
        toast.error(error?.response?.data?.message || error?.message || "Upload failed");
        return null;
      }
    },
    [],
  );

  const uploadVoiceToCloudinary = useCallback(
    async (blob: Blob, _duration: number): Promise<string | null> => {
      setIsUploadingVoice(true);
      try {
        const file = new File([blob], `voice-${Date.now()}.webm`, {
          type: blob.type || "audio/webm",
        });
        const url = await uploadToCloudinary(file, "voice");
        if (!url) throw new Error("Cloudinary returned empty URL");
        return url;
      } catch (error: any) {
        console.error("Voice upload error:", error);
        toast.error(error?.message || "Voice upload failed");
        return null;
      } finally {
        setIsUploadingVoice(false);
      }
    },
    [uploadToCloudinary],
  );

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mime = getSupportedMimeType();
      const mediaRecorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const finalDuration = recordingDurationRef.current;
        clearRecordingTimer();
        stopVisualizer();
        stopTracks();

        const blobType = mediaRecorder.mimeType || mime || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: blobType });

        setRecordingBlob(blob);
        setRecordingDuration(0);
        recordingDurationRef.current = 0;
        setIsRecording(false);

        const url = URL.createObjectURL(blob);
        setPreviewAudioUrl((prev) => {
          if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
          return url;
        });

        setMediaPreview({
          url,
          type: "audio",
          name: "Voice message",
        });

        const dur = Math.max(1, finalDuration || 1);
        setAudioDuration(dur);
        setAudioProgress(0);

        // Upload immediately in background. If it fails, the user can
        // still tap Send → handleSend re-tries the upload.
        const uploadedUrl = await uploadVoiceToCloudinary(blob, dur);

        if (uploadedUrl) {
          setMediaPreview((prev) =>
            prev ? { ...prev, url: uploadedUrl } : null,
          );
          setPreviewAudioUrl((prev) => {
            if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
            return uploadedUrl;
          });
          toast.success("🎙️ Voice ready to send");
        }
        // If upload failed, we deliberately leave mediaPreview.url as the
        // blob so handleSend knows to retry it.
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);
      recordingDurationRef.current = 0;
      setRecordingBlob(null);
      setAudioProgress(0);
      setIsPlaying(false);

      startVisualizer(stream);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => {
          const next = d + 1;
          recordingDurationRef.current = next;
          return next;
        });
      }, 1000);
    } catch (err) {
      console.error("Microphone error:", err);
      toast.error(
        "Unable to access microphone. Please check permissions in your browser settings.",
      );
      stopVisualizer();
      stopTracks();
      setIsRecording(false);
    }
  }, [startVisualizer, stopVisualizer, uploadVoiceToCloudinary]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    } else {
      clearRecordingTimer();
      stopVisualizer();
      stopTracks();
      setIsRecording(false);
    }
  }, [stopVisualizer]);

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording();
    else startRecording();
  }, [isRecording, startRecording, stopRecording]);

  const discardRecording = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (previewAudioUrl && previewAudioUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewAudioUrl);
    }
    setPreviewAudioUrl(null);
    setRecordingBlob(null);
    setMediaPreview(null);
    setAudioDuration(0);
    setAudioProgress(0);
    setIsPlaying(false);
  }, [previewAudioUrl]);

  const activeAudioUrl =
    previewAudioUrl ||
    (mediaPreview?.type === "audio" ? mediaPreview.url : null);

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !activeAudioUrl) return;
    if (audio.paused) {
      audio.play().catch((err) => console.error("Audio playback error:", err));
    } else {
      audio.pause();
    }
  }, [activeAudioUrl]);

  const handleAudioTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const d =
      isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : audioDuration;

    if (d > 0) {
      setAudioProgress(Math.min(100, (audio.currentTime / d) * 100));
    }
  }, [audioDuration]);

  const handleAudioEnded = useCallback(() => {
    setIsPlaying(false);
    setAudioProgress(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  }, []);

  const handleAudioSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const audio = audioRef.current;
      const pct = parseFloat(e.target.value);
      setAudioProgress(pct);

      if (!audio) return;
      const d =
        isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : audioDuration;
      if (d > 0) audio.currentTime = (pct / 100) * d;
    },
    [audioDuration],
  );

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (audio && isFinite(audio.duration) && audio.duration > 0) {
      setAudioDuration(audio.duration);
    }
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    let id = 0;
    const tick = () => {
      handleAudioTimeUpdate();
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [isPlaying, handleAudioTimeUpdate]);

  useEffect(() => {
    if (editingMessage) {
      setContent(editingMessage.content || "");
      setMediaPreview(null);
      setFileAttachment(null);
      setShowAttachmentMenu(false);
      setShowEmojiPicker(false);
      discardRecording();
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        const len = editingMessage.content?.length || 0;
        textareaRef.current?.setSelectionRange(len, len);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingMessage?.id]);

  // Back from editing a message: bring back this chat's unsent draft
  // (declared before the save effect so the draft is read before it's overwritten)
  useEffect(() => {
    if (!editingMessage && draftKey) setContent(getDraft(draftKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingMessage?.id]);

  // Keep the draft while typing (not while editing an existing message)
  useEffect(() => {
    if (draftKey && !editingMessage) setDraft(draftKey, content);
  }, [content, draftKey, editingMessage]);

  // ── @mentions (groups) ─────────────────────────────────────
  const mentionQuery = useMemo(() => {
    if (!mentionCandidates?.length || editingMessage) return null;
    const match = /(?:^|\s)@([\p{L}\p{N}_]*)$/u.exec(content);
    return match ? match[1].toLowerCase() : null;
  }, [content, mentionCandidates, editingMessage]);

  const mentionMatches = useMemo(
    () =>
      mentionQuery === null
        ? []
        : (mentionCandidates ?? []).filter((c) => c.name.toLowerCase().includes(mentionQuery)).slice(0, 6),
    [mentionQuery, mentionCandidates],
  );

  useEffect(() => setMentionIndex(0), [mentionQuery]);

  const insertMention = useCallback((name: string) => {
    setContent((prev) => prev.replace(/@([\p{L}\p{N}_]*)$/u, `@${name} `));
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        120,
      )}px`;
    }
  }, [content]);

  const stopTyping = useCallback(() => {
    if (isTypingState) {
      setIsTypingState(false);
      onTyping?.(false);
    }
  }, [isTypingState, onTyping]);

  const handleTyping = useCallback(
    (value: string) => {
      setContent(value);
      if (value.trim().length > 0) {
        if (!isTypingState) {
          setIsTypingState(true);
          onTyping?.(true);
        }
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => stopTyping(), 2000);
      } else {
        stopTyping();
      }
    },
    [isTypingState, onTyping, stopTyping],
  );

  const handleCancelEdit = useCallback(() => {
    setContent("");
    setMediaPreview(null);
    setFileAttachment(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    onCancelEdit?.();
  }, [onCancelEdit]);

  const handleSend = useCallback(() => {
    // ── Voice message branch ─────────────────────────────────
    if (mediaPreview?.type === "audio") {
      const audioUrl = mediaPreview.url;

      // Case A: still a local blob → upload then send
      if (audioUrl.startsWith("blob:")) {
        if (!recordingBlob) {
          toast.error("Voice is still processing…");
          return;
        }
        const dur = Math.max(
          1,
          Math.floor(audioDuration || recordingDurationRef.current || 1),
        );
        // Don't gate the button on upload state — just fire-and-forget.
        uploadVoiceToCloudinary(recordingBlob, dur)
          .then((url) => {
            if (url) {
              onSend("🎤 Voice message", "VOICE_NOTE", url, url, { duration: dur });
              toast.success("🎙️ Voice message sent!");
              discardRecording();
              setContent("");
              setFileAttachment(null);
              setShowAttachmentMenu(false);
              setShowEmojiPicker(false);
              stopTyping();
            } else {
              toast.error("Failed to upload voice. Please try again.");
            }
          })
          .catch(() => {
            toast.error("Failed to upload voice. Please try again.");
          });
        return;
      }

      // Case B: already uploaded → send immediately
      if (audioUrl.startsWith("http")) {
        const dur = Math.max(
          1,
          Math.round(audioDuration || recordingDurationRef.current || 1),
        );
        onSend("🎤 Voice message", "VOICE_NOTE", audioUrl, audioUrl, { duration: dur });
        toast.success("🎙️ Voice message sent!");
        discardRecording();
        setContent("");
        setFileAttachment(null);
        setShowAttachmentMenu(false);
        setShowEmojiPicker(false);
        stopTyping();
        return;
      }

      // Anything else isn't a real uploaded file — never send it
      toast.error("This voice note couldn't be uploaded. Please record it again.");
      return;
    }

    // ── Photos / videos (one, view-once, or an album) ─────────
    if (album.length) {
      if (album.some((a) => !a.url && !a.failed)) {
        toast.error("Still uploading — send it in a moment");
        return;
      }
      const ready = album.filter((a) => a.url);
      if (!ready.length) {
        toast.error("Upload failed. Remove the attachments and try again.");
        return;
      }
      const attachments: AlbumAttachment[] = ready.map((a) => ({
        url: a.url!,
        type: a.kind,
        filename: a.file.name,
        mimeType: a.file.type,
        size: a.file.size,
      }));
      const first = attachments[0];
      onSend(
        content.trim(),
        first.type,
        first.url,
        first.url,
        attachments.length > 1 ? { attachments } : { isViewOnce: viewOnce },
      );
      album.forEach((a) => URL.revokeObjectURL(a.localUrl));
      setAlbum([]);
      setViewOnce(false);
      setContent("");
      setShowAttachmentMenu(false);
      setShowEmojiPicker(false);
      stopTyping();
      return;
    }

    // ── Text / image / video / file branch ────────────────────
    if (!content.trim() && !mediaPreview && !fileAttachment) return;

    // A blob: preview only exists in this browser tab; sending it would leave a broken
    // message for everyone (and for you after a refresh)
    if (mediaPreview && !mediaPreview.url.startsWith("http")) {
      toast.error(
        isUploading
          ? "Still uploading — send it in a moment"
          : "Upload failed. Remove the attachment and try again.",
      );
      return;
    }

    let messageType = "TEXT";
    let mediaUrl = mediaPreview?.url;
    let fileUrl = fileAttachment?.url;

    if (mediaPreview) {
      // Audio previews are sent by the voice-message branch above
      messageType = mediaPreview.type === "video" ? "VIDEO" : "IMAGE";
      if (mediaPreview.type === "image" || mediaPreview.type === "video") {
        fileUrl = mediaPreview.url;
      }
    } else if (fileAttachment) {
      messageType = "FILE";
      mediaUrl = fileAttachment.url;
    }

    onSend(
      content.trim(),
      messageType,
      mediaUrl,
      fileUrl,
      messageType === "FILE" && fileAttachment
        ? {
            fileName: fileAttachment.name,
            fileSize: fileAttachment.size,
            mimeType: fileAttachment.type,
          }
        : messageType === "IMAGE" || messageType === "VIDEO"
          ? { isViewOnce: viewOnce }
          : undefined,
    );
    setViewOnce(false);

    setContent("");
    setMediaPreview(null);
    setFileAttachment(null);
    setShowAttachmentMenu(false);
    setShowEmojiPicker(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    stopTyping();
  }, [
    content,
    mediaPreview,
    fileAttachment,
    isUploading,
    recordingBlob,
    audioDuration,
    onSend,
    uploadVoiceToCloudinary,
    discardRecording,
    stopTyping,
    album,
    viewOnce,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // @mention suggestions take the arrow keys, Enter and Tab while open
      if (mentionMatches.length) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          setMentionIndex((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + mentionMatches.length) % mentionMatches.length);
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          insertMention(mentionMatches[mentionIndex]?.name ?? mentionMatches[0].name);
          return;
        }
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === "Escape" && editingMessage) handleCancelEdit();
    },
    [handleSend, editingMessage, handleCancelEdit, mentionMatches, mentionIndex, insertMention],
  );

  // ── Albums: several photos/videos, each uploading with its own progress ──
  const albumRef = useRef<AlbumItem[]>([]);
  useEffect(() => {
    albumRef.current = album;
  }, [album]);

  const addToAlbum = useCallback(
    (files: File[]) => {
      const tooBig = files.filter((f) => f.size > MAX_FILE_BYTES);
      if (tooBig.length) toast.error(`${tooBig.length} file${tooBig.length > 1 ? "s are" : " is"} over 50MB and skipped`);

      const room = MAX_ALBUM - albumRef.current.length;
      const usable = files.filter((f) => f.size <= MAX_FILE_BYTES);
      if (usable.length > room) toast.info(`You can send up to ${MAX_ALBUM} photos and videos at once`);

      const items: AlbumItem[] = usable.slice(0, Math.max(0, room)).map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        localUrl: URL.createObjectURL(file),
        kind: file.type.startsWith("video/") ? "VIDEO" : "IMAGE",
        progress: 0,
      }));
      if (!items.length) return;

      albumRef.current = [...albumRef.current, ...items];
      setAlbum(albumRef.current);
      if (albumRef.current.length > 1) setViewOnce(false);
      setShowAttachmentMenu(false);

      const update = (id: string, changes: Partial<AlbumItem>) =>
        setAlbum((prev) => prev.map((a) => (a.id === id ? { ...a, ...changes } : a)));
      for (const item of items) {
        void uploadToCloudinary(item.file, item.kind === "VIDEO" ? "video" : "image", (p) =>
          update(item.id, { progress: p }),
        ).then((url) => update(item.id, url ? { url, progress: 1 } : { failed: true }));
      }
    },
    [uploadToCloudinary],
  );

  const removeAlbumItem = useCallback((id: string) => {
    setAlbum((prev) => {
      prev.find((a) => a.id === id && URL.revokeObjectURL(a.localUrl));
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  /** One attachment (audio file or document) with a preview before sending */
  const uploadSingle = useCallback(
    async (file: File, type: "audio" | "file") => {
      if (file.size > MAX_FILE_BYTES) {
        toast.error("File size exceeds 50MB limit");
        return;
      }

      setIsUploading(true);
      setUploadProgress(0);
      const localUrl = URL.createObjectURL(file);

      try {
        if (type === "audio") {
          setMediaPreview({ url: localUrl, type: "audio", name: file.name });
        } else {
          setFileAttachment({ name: file.name, url: localUrl, size: file.size, type: file.type });
        }

        const uploadedUrl = await uploadToCloudinary(file, type, setUploadProgress);

        if (uploadedUrl) {
          if (type === "audio") {
            setMediaPreview({ url: uploadedUrl, type: "audio", name: file.name });
          } else {
            setFileAttachment({ name: file.name, url: uploadedUrl, size: file.size, type: file.type });
          }
          URL.revokeObjectURL(localUrl);
        } else {
          toast.error("Upload failed — remove the attachment and try again.");
        }
      } catch (error) {
        console.error("Upload error:", error);
        toast.error("Failed to upload file");
      } finally {
        setIsUploading(false);
        setShowAttachmentMenu(false);
      }
    },
    [uploadToCloudinary],
  );

  /** Several documents at once: each is uploaded and sent as its own message */
  const sendDocuments = useCallback(
    async (docs: File[]) => {
      if (docs.length === 1 && !fileAttachment) {
        await uploadSingle(docs[0], "file");
        return;
      }
      setIsUploading(true);
      let sent = 0;
      try {
        for (const [i, doc] of docs.entries()) {
          if (doc.size > MAX_FILE_BYTES) {
            toast.error(`${doc.name} is over 50MB`);
            continue;
          }
          const url = await uploadToCloudinary(doc, "file", (p) => setUploadProgress((i + p) / docs.length));
          if (url) {
            onSend("", "FILE", url, url, { fileName: doc.name, fileSize: doc.size, mimeType: doc.type });
            sent++;
          }
        }
        if (sent) toast.success(`📤 Sent ${sent} file${sent > 1 ? "s" : ""}`);
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
        setShowAttachmentMenu(false);
      }
    },
    [fileAttachment, uploadSingle, uploadToCloudinary, onSend],
  );

  /** Routes picked, pasted or dropped files to the right flow */
  const addFiles = useCallback(
    (files: File[]) => {
      if (editingMessage || isSelectionMode || !files.length) return;
      const media = files.filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
      const audio = files.filter((f) => f.type.startsWith("audio/"));
      const docs = files.filter((f) => !media.includes(f) && !audio.includes(f) && DOC_EXTENSIONS.test(f.name));
      const unsupported = files.length - media.length - audio.length - docs.length;

      if (unsupported) toast.error(`${unsupported} file${unsupported > 1 ? "s aren't" : " isn't"} a supported type`);
      if (media.length) addToAlbum(media);
      if (audio.length) void uploadSingle(audio[0], "audio");
      if (docs.length) void sendDocuments(docs);
    },
    [editingMessage, isSelectionMode, addToAlbum, uploadSingle, sendDocuments],
  );

  useImperativeHandle(ref, () => ({ addFiles }), [addFiles]);

  const handleFileUpload = useCallback(
    async (
      e: React.ChangeEvent<HTMLInputElement>,
      type: "image" | "video" | "audio" | "file",
    ) => {
      if (editingMessage) return;
      const picked = Array.from(e.target.files ?? []);
      e.target.value = "";
      if (!picked.length) return;
      if (type === "image" || type === "video") {
        addToAlbum(picked);
        return;
      }
      if (type === "file") {
        void sendDocuments(picked);
        return;
      }
      await uploadSingle(picked[0], "audio");
    },
    [editingMessage, addToAlbum, sendDocuments, uploadSingle],
  );

  const removeAttachment = useCallback(() => {
    if (mediaPreview?.type === "audio" && recordingBlob) {
      discardRecording();
    } else {
      if (mediaPreview?.url && mediaPreview.url.startsWith("blob:")) {
        URL.revokeObjectURL(mediaPreview.url);
      }
      setMediaPreview(null);
    }
    setFileAttachment(null);
    album.forEach((a) => URL.revokeObjectURL(a.localUrl));
    setAlbum([]);
    setViewOnce(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
    if (audioInputRef.current) audioInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [discardRecording, mediaPreview, recordingBlob, album]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDuration = (seconds: number) => {
    const s = Math.floor(seconds || 0);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      clearRecordingTimer();
      stopVisualizer();
      stopTracks();
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      if (previewAudioUrl && previewAudioUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewAudioUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isEditMode = !!editingMessage;
  const hasVoice = mediaPreview?.type === "audio" || !!recordingBlob;
  const canSend =
    (content.trim() || mediaPreview || fileAttachment || hasVoice || album.length > 0) &&
    !isUploading &&
    !isRecording &&
    !isSelectionMode;
  const canSchedule =
    !!onSchedule && !isEditMode && !!content.trim() && !album.length && !mediaPreview && !fileAttachment && !hasVoice;

  return (
    <motion.div
      layout
      className="space-y-3"
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
    >
      {/* Hidden Inputs */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e, "image")}
      />
      <input
        type="file"
        ref={videoInputRef}
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e, "video")}
      />
      <input
        type="file"
        ref={audioInputRef}
        accept="audio/*"
        className="hidden"
        onChange={(e) => handleFileUpload(e, "audio")}
      />
      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e, "file")}
      />

      {/* Hidden Audio Player for Preview */}
      {activeAudioUrl && (
        <audio
          key={activeAudioUrl}
          ref={audioRef}
          src={activeAudioUrl}
          onTimeUpdate={handleAudioTimeUpdate}
          onEnded={handleAudioEnded}
          onLoadedMetadata={handleLoadedMetadata}
          onDurationChange={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          className="hidden"
          preload="auto"
        />
      )}

      {/* Connection Warning */}
      <AnimatePresence>
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border border-amber-200/60 dark:border-amber-500/30 rounded-2xl"
          >
            <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
              Reconnecting… Messages will send when connected
            </span>
            <div className="flex-1" />
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording UI — Premium Waveform */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: 10 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: 10 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-gradient-to-r from-red-500/10 via-rose-500/5 to-red-500/10 border border-red-500/20 dark:border-red-500/30 backdrop-blur-md">
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [1, 0.7, 1] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
              >
                <div className="w-1.5 h-1.5 bg-white rounded-full" />
              </motion.div>

              <div className="flex h-10 flex-1 items-center justify-center gap-[3px]">
                {audioLevels.map((level, i) => (
                  <motion.div
                    key={i}
                    className="w-[3px] rounded-full bg-gradient-to-t from-red-500 to-rose-400"
                    style={{
                      height: `${Math.max(12, level * 100)}%`,
                      opacity: 0.4 + level * 0.6,
                    }}
                    transition={{ duration: 0.05 }}
                  />
                ))}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-bold tabular-nums text-red-600 dark:text-red-400 tracking-wider">
                  {formatDuration(recordingDuration)}
                </span>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="shrink-0 rounded-full bg-red-500 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-red-500/30 hover:bg-red-600 hover:shadow-red-500/50 active:scale-95 transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media Previews */}
      <AnimatePresence>
        {(mediaPreview || fileAttachment || isUploading || isUploadingVoice || album.length > 0) &&
          !isEditMode &&
          !isRecording && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="flex items-center gap-3 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/50 rounded-2xl shadow-sm"
            >
              {isUploadingVoice && (
                <div className="flex w-full items-center justify-center gap-2 py-2 text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing voice…
                </div>
              )}
              {isUploading && (
                <div className="w-full space-y-1.5 py-1">
                  <div className="flex items-center justify-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading… {Math.round(uploadProgress * 100)}%
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-200"
                      style={{ width: `${Math.round(uploadProgress * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {album.length > 0 && !isUploading && (
                <div className="w-full space-y-2">
                  <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                    {album.map((item) => (
                      <div key={item.id} className="group/preview relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-900 shadow-sm">
                        {item.kind === "VIDEO" ? (
                          <>
                            <video src={item.localUrl} muted className="h-full w-full object-cover" />
                            <Video className="absolute bottom-1 left-1 h-3.5 w-3.5 text-white drop-shadow" />
                          </>
                        ) : (
                          <img src={item.localUrl} alt="" className="h-full w-full object-cover" />
                        )}
                        {!item.url && !item.failed && (
                          <div className="absolute inset-0 flex items-end bg-black/40">
                            <div className="h-1 bg-indigo-400 transition-[width] duration-200" style={{ width: `${Math.round(item.progress * 100)}%` }} />
                          </div>
                        )}
                        {item.failed && (
                          <div className="absolute inset-0 flex items-center justify-center bg-red-500/70" title="Upload failed">
                            <AlertCircle className="h-5 w-5 text-white" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeAlbumItem(item.id)}
                          aria-label="Remove"
                          className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover/preview:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {album.length < MAX_ALBUM && (
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        aria-label="Add more photos"
                        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-indigo-400 hover:text-indigo-500 dark:border-slate-600"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      {album.length} {album.length === 1 ? "item" : "items"}
                      {album.length > 1 ? " · sent as an album" : ""} · add a caption below
                    </span>
                    {album.length === 1 && (
                      <button
                        type="button"
                        onClick={() => setViewOnce((v) => !v)}
                        title="The recipient can open it only once"
                        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold transition ${
                          viewOnce
                            ? "bg-indigo-500 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        <span className={`flex h-4 w-4 items-center justify-center rounded-full border border-dashed text-[9px] ${viewOnce ? "border-white" : "border-current"}`}>
                          1
                        </span>
                        View once
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!isUploading &&
                !isUploadingVoice &&
                mediaPreview?.type === "audio" && (
                  <div className="flex items-center gap-3 w-full">
                    <button
                      type="button"
                      onClick={togglePlayback}
                      className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/40 flex items-center justify-center text-white shrink-0 transition-all active:scale-95"
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4 ml-0.5" />
                      )}
                    </button>

                    <div className="flex-1 flex items-center gap-3 min-w-0">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={0.1}
                        value={audioProgress}
                        onChange={handleAudioSeek}
                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-600"
                      />
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 min-w-[40px] tabular-nums">
                        {formatDuration(
                          isPlaying || audioProgress > 0
                            ? (audioProgress / 100) * audioDuration
                            : audioDuration,
                        )}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={removeAttachment}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-full transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}

              {!isUploading &&
                !isUploadingVoice &&
                mediaPreview?.type === "image" && (
                  <div className="relative group/preview">
                    <div className="w-16 h-16 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-sm overflow-hidden bg-slate-50 dark:bg-slate-800">
                      <img
                        src={mediaPreview.url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={removeAttachment}
                      className="absolute -top-2 -right-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-1 rounded-full shadow-lg opacity-0 group-hover/preview:opacity-100 transition-all hover:scale-110 active:scale-95"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

              {!isUploading &&
                !isUploadingVoice &&
                mediaPreview?.type === "video" && (
                  <div className="relative group/preview w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center shadow-sm overflow-hidden">
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                      <Video className="w-6 h-6 text-white" />
                    </div>
                    <span className="absolute bottom-1 right-1.5 text-[9px] font-medium text-white/90 z-20">
                      Video
                    </span>
                    <button
                      type="button"
                      onClick={removeAttachment}
                      className="absolute -top-2 -right-2 bg-white text-slate-900 p-1 rounded-full shadow-lg opacity-0 group-hover/preview:opacity-100 transition-all hover:scale-110 active:scale-95 z-30"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

              {!isUploading && !isUploadingVoice && fileAttachment && (
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-sm shadow-sm">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                    <FileIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                      {fileAttachment.name}
                    </p>
                    {fileAttachment.size != null && (
                      <p className="text-[11px] text-slate-400">
                        {formatFileSize(fileAttachment.size)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={removeAttachment}
                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </motion.div>
          )}
      </AnimatePresence>

      {/* Attachment Menu */}
      <AnimatePresence>
        {showAttachmentMenu && !isEditMode && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-[4.5rem] left-2 z-50 flex flex-wrap gap-1.5 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/50 rounded-2xl shadow-2xl w-[280px]"
          >
            {[
              {
                icon: ImageIcon,
                label: "Image",
                action: imageInputRef,
                color: "text-blue-500",
                bg: "bg-blue-50 dark:bg-blue-500/10",
              },
              {
                icon: Video,
                label: "Video",
                action: videoInputRef,
                color: "text-rose-500",
                bg: "bg-rose-50 dark:bg-rose-500/10",
              },
              {
                icon: Music,
                label: "Audio",
                action: audioInputRef,
                color: "text-purple-500",
                bg: "bg-purple-50 dark:bg-purple-500/10",
              },
              {
                icon: FileIcon,
                label: "Doc",
                action: fileInputRef,
                color: "text-orange-500",
                bg: "bg-orange-50 dark:bg-orange-500/10",
              },
              {
                icon: Sticker,
                label: "Sticker",
                action: null,
                color: "text-emerald-500",
                bg: "bg-emerald-50 dark:bg-emerald-500/10",
              },
              {
                icon: MapPin,
                label: "Location",
                action: "location",
                color: "text-indigo-500",
                bg: "bg-indigo-50 dark:bg-indigo-500/10",
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  if (item.action === "location") {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        onSend(
                          `📍 Location: ${pos.coords.latitude}, ${pos.coords.longitude}`,
                          "LOCATION",
                        );
                        setShowAttachmentMenu(false);
                      },
                      () => toast.error("Unable to get location."),
                    );
                  } else if (item.action && typeof item.action !== "string" && item.action.current) {
                    item.action.current.click();
                  } else {
                    toast.info(`${item.label} coming soon!`);
                    setShowAttachmentMenu(false);
                  }
                }}
                className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl hover:bg-slate-100/80 dark:hover:bg-white/5 transition-all w-[calc(33.333%-0.375rem)] ${item.bg}`}
              >
                <item.icon className={`w-5 h-5 ${item.color}`} />
                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                  {item.label}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* @mention suggestions */}
      <AnimatePresence>
        {mentionMatches.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            role="listbox"
            aria-label="Mention someone"
            className="absolute bottom-[4.5rem] left-14 z-50 w-60 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 py-1 shadow-2xl backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/95"
          >
            {mentionMatches.map((c, i) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={i === mentionIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(c.name);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition ${
                  i === mentionIndex ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" : "text-slate-700 dark:text-slate-200"
                }`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-semibold text-white">
                  {c.name.charAt(0).toUpperCase()}
                </span>
                {c.name}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Composer */}
      <motion.div
        className={`relative flex items-end gap-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border p-2 rounded-2xl shadow-sm transition-all duration-200 ${
          isEditMode
            ? "border-amber-400 ring-4 ring-amber-400/10 shadow-amber-500/5"
            : isFocused
              ? "border-indigo-500 ring-4 ring-indigo-500/10 shadow-indigo-500/5"
              : "border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600"
        }`}
      >
        <div className="flex items-center gap-0.5 pb-0.5">
          {!isEditMode && (
            <>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                className={`p-2.5 rounded-xl transition-all ${
                  showAttachmentMenu
                    ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5 dark:hover:text-slate-200"
                }`}
                title="Attach"
              >
                <Plus
                  className={`w-5 h-5 transition-transform duration-300 ${
                    showAttachmentMenu ? "rotate-45" : ""
                  }`}
                />
              </motion.button>
            </>
          )}
          {isEditMode && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200/50 dark:border-amber-500/20"
            >
              <Edit className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                Editing
              </span>
            </motion.div>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleTyping(e.target.value)}
          onPaste={(e) => {
            // Paste screenshots, photos or files straight into the chat
            const files = Array.from(e.clipboardData?.files ?? []);
            if (!files.length) return;
            e.preventDefault();
            addFiles(files);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={
            isEditMode
              ? "Edit your message… (Esc to cancel)"
              : isRecording
                ? "Recording…"
                : isSelectionMode
                  ? "Select messages…"
                  : "Type a message…"
          }
          rows={1}
          disabled={isRecording || isSelectionMode}
          className="flex-1 bg-transparent py-2.5 px-1 text-[15px] text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none resize-none max-h-32 min-h-[44px] custom-scrollbar"
        />

        <div className="flex items-center gap-0.5 pb-0.5">
          {isEditMode && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={handleCancelEdit}
              className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
              title="Cancel edit"
            >
              <X className="w-5 h-5" />
            </motion.button>
          )}

          {!isEditMode && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.9 }}
              type="button"
              onClick={toggleRecording}
              className={`p-2.5 rounded-xl transition-all relative ${
                isRecording
                  ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5 dark:hover:text-slate-200"
              }`}
              title={isRecording ? "Stop recording" : "Voice message"}
            >
              {isRecording ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </motion.button>
          )}

          {!isEditMode && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.9 }}
              type="button"
              onClick={() => {
                setShowEmojiPicker(!showEmojiPicker);
                onEmojiPickerToggle?.();
              }}
              className={`p-2.5 rounded-xl transition-all hidden sm:block ${
                showEmojiPicker
                  ? "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5 dark:hover:text-slate-200"
              }`}
              title="Emoji"
            >
              <Smile className="w-5 h-5" />
            </motion.button>
          )}

          {canSchedule && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.9 }}
              type="button"
              onClick={() => setShowSchedule(true)}
              className="p-2.5 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all"
              title="Schedule message"
              aria-label="Schedule message"
            >
              <CalendarClock className="w-5 h-5" />
            </motion.button>
          )}

          <motion.button
            whileHover={canSend ? { scale: 1.05 } : {}}
            whileTap={canSend ? { scale: 0.95 } : {}}
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className={`p-3 rounded-xl shrink-0 transition-all ml-1 ${
              !canSend || isUploadingVoice
                ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                : isEditMode
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:shadow-lg hover:shadow-amber-500/30 text-white"
                  : "bg-gradient-to-r from-indigo-500 to-violet-600 hover:shadow-lg hover:shadow-indigo-500/30 text-white"
            }`}
            title={isEditMode ? "Save changes" : "Send message"}
          >
            {isUploading || isUploadingVoice ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isEditMode ? (
              <Check className="w-5 h-5" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Emoji Picker */}
      <AnimatePresence>
        {showEmojiPicker && !isEditMode && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-[4.5rem] right-2 z-50 flex flex-wrap gap-1.5 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/50 rounded-2xl shadow-2xl w-[280px]"
          >
            {[
              "😊",
              "😂",
              "❤️",
              "🔥",
              "👍",
              "👏",
              "🙏",
              "🎉",
              "😍",
              "🤔",
              "😭",
              "🥺",
              "💯",
              "✨",
              "🌟",
              "🎊",
              "🚀",
              "💪",
              "🤗",
              "🥰",
              "😎",
              "🤩",
              "😇",
              "🤣",
            ].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setContent((prev) => prev + emoji);
                  setShowEmojiPicker(false);
                  textareaRef.current?.focus();
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-xl transition-all hover:scale-110 active:scale-95"
              >
                {emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSchedule && onSchedule && (
          <ScheduleDialog
            text={content.trim()}
            onClose={() => setShowSchedule(false)}
            onSchedule={async (sendAt) => {
              if (await onSchedule(content.trim(), sendAt)) {
                setContent("");
                stopTyping();
              }
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
});
