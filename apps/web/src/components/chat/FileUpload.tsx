import React, { useState, useRef, useEffect, useCallback } from 'react';
import { File, Image as ImageIcon, Video, Music, FileText, X, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { tr } from "../../i18n/core";

interface FileUploadProps {
  onUpload: (file: File) => Promise<void>;
  onCancel?: () => void;
  acceptedTypes?: string[];
  maxSizeMB?: number;
  multiple?: boolean;
}

interface FilePreviewItem {
  id: string;
  file: File;
  previewUrl: string | null;
  status: 'idle' | 'uploading' | 'completed' | 'error';
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onUpload,
  onCancel,
  acceptedTypes = ['image/*', 'video/*', 'audio/*', 'application/*'],
  maxSizeMB = 50,
  multiple = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileList, setFileList] = useState<FilePreviewItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // Clean up Object URLs when items are removed or component unmounts
  useEffect(() => {
    return () => {
      fileList.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, [fileList]);

  const getFileMeta = (type: string) => {
    if (type.startsWith('image/')) {
      return { icon: ImageIcon, textClass: 'text-purple-600', bgClass: 'bg-purple-100' };
    }
    if (type.startsWith('video/')) {
      return { icon: Video, textClass: 'text-rose-600', bgClass: 'bg-rose-100' };
    }
    if (type.startsWith('audio/')) {
      return { icon: Music, textClass: 'text-emerald-600', bgClass: 'bg-emerald-100' };
    }
    if (type.includes('pdf')) {
      return { icon: FileText, textClass: 'text-red-600', bgClass: 'bg-red-100' };
    }
    return { icon: File, textClass: 'text-blue-600', bgClass: 'bg-blue-100' };
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const processFiles = useCallback(
    (incomingFiles: FileList | File[]) => {
      const validAdditions: FilePreviewItem[] = [];

      Array.from(incomingFiles).forEach((file) => {
        // Size validation
        if (file.size > maxSizeMB * 1024 * 1024) {
          toast.error(tr("{name} exceeds maximum limit of {maxSizeMB}MB", { name: file.name, maxSizeMB }));
          return;
        }

        // Type validation
        const isTypeAllowed = acceptedTypes.some((type) => {
          if (type.endsWith('/*')) {
            return file.type.startsWith(type.slice(0, -2));
          }
          return file.type === type;
        });

        if (!isTypeAllowed && acceptedTypes.length > 0) {
          toast.error(tr("{name} is not an allowed file format", { name: file.name }));
          return;
        }

        // Generate Preview for images
        const isImage = file.type.startsWith('image/');
        const previewUrl = isImage ? URL.createObjectURL(file) : null;

        validAdditions.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          previewUrl,
          status: 'idle',
        });
      });

      if (validAdditions.length > 0) {
        setFileList((prev) => (multiple ? [...prev, ...validAdditions] : [validAdditions[0]]));
      }
    },
    [acceptedTypes, maxSizeMB, multiple]
  );

  // Drag Event Handlers with hover flicker prevention
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const removeItem = (id: string) => {
    setFileList((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleStartUpload = async () => {
    if (fileList.length === 0 || isUploading) return;
    setIsUploading(true);

    let successCount = 0;

    for (let i = 0; i < fileList.length; i++) {
      const currentItem = fileList[i];
      
      // Update item state to uploading
      setFileList((prev) =>
        prev.map((item) => (item.id === currentItem.id ? { ...item, status: 'uploading' } : item))
      );

      try {
        await onUpload(currentItem.file);
        successCount += 1;
        
        setFileList((prev) =>
          prev.map((item) => (item.id === currentItem.id ? { ...item, status: 'completed' } : item))
        );
      } catch {
        setFileList((prev) =>
          prev.map((item) => (item.id === currentItem.id ? { ...item, status: 'error' } : item))
        );
        toast.error(tr("Failed to upload {name}", { name: currentItem.file.name }));
      }
    }

    setIsUploading(false);

    if (successCount > 0) {
      toast.success(tr("Successfully uploaded {successCount} file(s)", { successCount }));
      setTimeout(() => {
        setFileList([]);
        onCancel?.();
      }, 600);
    }
  };

  return (
    <div className="w-full space-y-3 font-sans">
      {/* Drop Zone Area */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50/70 scale-[0.99]'
            : 'border-gray-200 hover:border-gray-300 bg-gray-50/50 hover:bg-gray-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={acceptedTypes.join(',')}
          onChange={(e) => {
            if (e.target.files) processFiles(e.target.files);
            e.target.value = '';
          }}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="p-3 bg-white rounded-full shadow-sm border border-gray-100">
            <Upload className={`w-6 h-6 ${isDragging ? 'text-blue-500' : 'text-gray-500'}`} />
          </div>
          <p className="text-sm font-medium text-gray-700">
            <span className="text-blue-600 underline underline-offset-2">{tr("Click to upload")}</span> {" "}{tr("or drag and drop")}</p>
          <p className="text-xs text-gray-400">
            {acceptedTypes.join(', ')} {" "}{tr("(Max {maxSizeMB}MB)", { maxSizeMB })}</p>
        </div>
      </div>

      {/* Selected File Previews */}
      {fileList.length > 0 && (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {fileList.map((item) => {
            const { icon: Icon, textClass, bgClass } = getFileMeta(item.file.type);

            return (
              <div
                key={item.id}
                className="flex items-center gap-3 p-2.5 bg-white border border-gray-200 rounded-lg shadow-sm"
              >
                {/* Thumbnail Preview or Dynamic Icon */}
                {item.previewUrl ? (
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="w-10 h-10 object-cover rounded-md border border-gray-100 flex-shrink-0"
                  />
                ) : (
                  <div className={`p-2.5 rounded-lg flex-shrink-0 ${bgClass}`}>
                    <Icon className={`w-5 h-5 ${textClass}`} />
                  </div>
                )}

                {/* Info Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.file.name}</p>
                  <p className="text-xs text-gray-400">{formatFileSize(item.file.size)}</p>
                </div>

                {/* Dynamic Upload Status */}
                <div className="flex items-center gap-2">
                  {item.status === 'uploading' && (
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  )}
                  {item.status === 'completed' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  )}
                  {item.status === 'idle' && !isUploading && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label={tr("Remove file")}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Action Bar */}
          <div className="flex items-center justify-end gap-2 pt-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isUploading}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {tr("Cancel")}</button>
            )}

            <button
              type="button"
              onClick={handleStartUpload}
              disabled={isUploading || fileList.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {tr("Uploading...")}</>
              ) : (
                tr("Upload {fileList} {value}", { fileList: fileList.length, value: fileList.length === 1 ? 'file' : 'files' })
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};