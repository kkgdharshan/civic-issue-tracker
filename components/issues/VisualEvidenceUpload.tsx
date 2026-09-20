'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { UploadCloud, X, Film, Image as ImageIcon, AlertCircle } from 'lucide-react';

export interface StagedMediaFile {
  id: string;
  file: File;
  previewUrl: string;
  type: 'image' | 'video';
  sizeFormatted: string;
}

interface VisualEvidenceUploadProps {
  files: StagedMediaFile[];
  onFilesChange: (files: StagedMediaFile[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

const MAX_FILES_DEFAULT = 3;
const MAX_SIZE_MB_DEFAULT = 5;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];

export function VisualEvidenceUpload({
  files,
  onFilesChange,
  maxFiles = MAX_FILES_DEFAULT,
  maxSizeMB = MAX_SIZE_MB_DEFAULT,
}: VisualEvidenceUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to format bytes to human-readable size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Clear error after timeout
  const displayError = useCallback((msg: string) => {
    setErrorMessage(msg);
    const timer = setTimeout(() => {
      setErrorMessage(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, []);

  // Process incoming files (from drop or input select)
  const processFiles = useCallback(
    (newFilesList: FileList | File[]) => {
      setErrorMessage(null);
      const incoming = Array.from(newFilesList);
      if (incoming.length === 0) return;

      // Check slot availability
      const availableSlots = maxFiles - files.length;
      if (availableSlots <= 0) {
        displayError(`Maximum limit reached: You can only upload up to ${maxFiles} files.`);
        return;
      }

      const maxBytes = maxSizeMB * 1024 * 1024;
      const validStagedFiles: StagedMediaFile[] = [];
      const errors: string[] = [];

      for (const file of incoming) {
        // Validation: MIME type
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
          errors.push(`"${file.name}" has an unsupported format. Only JPG, PNG, and MP4 are accepted.`);
          continue;
        }

        // Validation: File Size (5MB limit)
        if (file.size > maxBytes) {
          errors.push(`"${file.name}" exceeds the ${maxSizeMB}MB limit (${formatFileSize(file.size)}).`);
          continue;
        }

        // Check if we reached slot limit
        if (validStagedFiles.length >= availableSlots) {
          errors.push(`Only ${availableSlots} more file(s) can be attached (max ${maxFiles}).`);
          break;
        }

        const isVideo = file.type === 'video/mp4';
        const previewUrl = URL.createObjectURL(file);

        validStagedFiles.push({
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          previewUrl,
          type: isVideo ? 'video' : 'image',
          sizeFormatted: formatFileSize(file.size),
        });
      }

      if (errors.length > 0) {
        displayError(errors[0]);
      }

      if (validStagedFiles.length > 0) {
        onFilesChange([...files, ...validStagedFiles]);
      }

      // Reset input element so re-selecting same file triggers change
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [files, maxFiles, maxSizeMB, onFilesChange, displayError]
  );

  // Remove individual staged file & revoke memory URL
  const handleRemove = useCallback(
    (idToRemove: string) => {
      const target = files.find((f) => f.id === idToRemove);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      onFilesChange(files.filter((f) => f.id !== idToRemove));
    },
    [files, onFilesChange]
  );

  // Cleanup all staged preview URLs on unmount to prevent browser memory leaks
  useEffect(() => {
    return () => {
      files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    };
  }, []);

  // Drag event handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Header / Section Label */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Visual Evidence / Media
        </label>
        <span className="text-[10px] font-mono text-slate-500">
          {files.length}/{maxFiles} Attached
        </span>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,video/mp4"
        onChange={(e) => {
          if (e.target.files) processFiles(e.target.files);
        }}
        className="hidden"
      />

      {/* Drag & Drop Zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`relative group flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 select-none ${
          isDragging
            ? 'border-emerald-500 bg-emerald-950/20 shadow-lg shadow-emerald-950/40 ring-2 ring-emerald-500/30'
            : 'border-slate-700 hover:border-slate-500 bg-slate-950/60 hover:bg-slate-900/80'
        }`}
      >
        <div className="flex flex-col items-center text-center">
          <div
            className={`p-2.5 rounded-xl border transition-all duration-200 mb-2 ${
              isDragging
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 scale-110'
                : 'bg-slate-900 border-slate-800 text-slate-400 group-hover:text-slate-200 group-hover:border-slate-700'
            }`}
          >
            <UploadCloud className="w-5 h-5" />
          </div>

          <p className="text-xs font-medium text-slate-200">
            Drag & drop visual evidence or <span className="text-emerald-400 underline underline-offset-2">click to browse</span>
          </p>

          <p className="text-[11px] text-slate-500 mt-0.5">
            Supports JPG, PNG, MP4 (Max {maxSizeMB}MB). Up to {maxFiles} files.
          </p>
        </div>
      </div>

      {/* Validation Error Banner / Inline Message */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center gap-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs animate-in fade-in slide-in-from-top-1"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="leading-tight">{errorMessage}</span>
        </div>
      )}

      {/* Staged Media Previews */}
      {files.length > 0 && (
        <div className="flex items-center gap-2.5 pt-1 overflow-x-auto pb-1">
          {files.map((item) => (
            <div
              key={item.id}
              className="relative group w-20 h-20 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 shadow-md shrink-0 transition-transform duration-150 hover:scale-[1.02]"
            >
              {/* Image vs Video Preview */}
              {item.type === 'video' ? (
                <div className="relative w-full h-full bg-slate-900 flex items-center justify-center">
                  <video
                    src={item.previewUrl}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                  />
                  <div className="absolute inset-0 bg-slate-950/30 flex items-center justify-center pointer-events-none">
                    <span className="p-1 rounded-full bg-slate-950/70 border border-slate-700 text-slate-300">
                      <Film className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <span className="absolute bottom-1 left-1 text-[8px] font-mono px-1 rounded bg-slate-900/90 text-cyan-300 border border-cyan-500/30">
                    MP4
                  </span>
                </div>
              ) : (
                <div className="relative w-full h-full">
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-1 left-1 text-[8px] font-mono px-1 rounded bg-slate-900/90 text-slate-300 border border-slate-700/60">
                    {item.sizeFormatted}
                  </span>
                </div>
              )}

              {/* Absolute Positioned 'X' Remove Action Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(item.id);
                }}
                aria-label={`Remove ${item.file.name}`}
                className="absolute top-1 right-1 h-5 w-5 rounded-full bg-slate-950/85 hover:bg-rose-600 text-slate-400 hover:text-white border border-slate-700/80 hover:border-rose-500 flex items-center justify-center transition-all duration-150 shadow-sm z-10"
              >
                <X className="w-3 h-3 stroke-[2.5]" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
