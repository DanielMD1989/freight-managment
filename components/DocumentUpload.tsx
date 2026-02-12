/**
 * Document Upload Component
 *
 * Reusable component for uploading company or truck documents.
 *
 * Features:
 * - File drag & drop support
 * - File type validation (PDF, JPG, PNG)
 * - File size validation (max 10MB)
 * - Upload progress indication
 * - Error handling and display
 *
 * Sprint 8 - Story 8.5: Document Upload System - Phase 2 UI
 */

"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import { CompanyDocumentType, TruckDocumentType } from "@prisma/client";

interface DocumentUploadProps {
  entityType: "company" | "truck";
  entityId: string;
  documentType: CompanyDocumentType | TruckDocumentType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUploadComplete?: (document: any) => void;
  onUploadError?: (error: string) => void;
  label?: string;
  helperText?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

export default function DocumentUpload({
  entityType,
  entityId,
  documentType,
  onUploadComplete,
  onUploadError,
  label,
  helperText,
}: DocumentUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate file
  const validateFile = (file: File): string | null => {
    // Check file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Invalid file type. Allowed types: PDF, JPG, PNG. Got: ${file.type}`;
    }

    // Check file extension
    const extension = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return `Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB. Got: ${(file.size / 1024 / 1024).toFixed(2)}MB`;
    }

    return null;
  };

  // Handle file selection
  const handleFileSelect = (file: File) => {
    const validationError = validateFile(file);

    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setError(null);
    setSuccess(false);
  };

  // Handle file input change
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle drag & drop
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Upload file
  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file first");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("type", documentType);
      formData.append("entityType", entityType);
      formData.append("entityId", entityId);

      // Simulate progress (since fetch doesn't support upload progress)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 200);

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await response.json();
      setSuccess(true);
      setSelectedFile(null);

      if (onUploadComplete) {
        onUploadComplete(data.document);
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to upload document";
      setError(errorMessage);
      setUploadProgress(0);

      if (onUploadError) {
        onUploadError(errorMessage);
      }
    } finally {
      setUploading(false);
    }
  };

  // Format document type for display
  const formatDocumentType = (type: string) => {
    return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="space-y-4">
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-[#064d51]/80">
          {label}
        </label>
      )}

      {/* Drag & Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-colors
          ${isDragging
            ? "border-[#1e9c99] bg-[#1e9c99]/10"
            : selectedFile
            ? "border-green-500 bg-green-50"
            : "border-[#064d51]/30 bg-[#f0fdfa] hover:border-[#1e9c99]"
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(",")}
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="space-y-2">
          {/* Icon */}
          <svg
            className="mx-auto h-12 w-12 text-[#064d51]/50"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Text */}
          {selectedFile ? (
            <div>
              <p className="text-sm font-medium text-green-600">
                {selectedFile.name}
              </p>
              <p className="text-xs text-[#064d51]/60">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-[#064d51]/70">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-[#064d51]/60">
                PDF, JPG, or PNG (max 10MB)
              </p>
            </div>
          )}

          {helperText && !selectedFile && (
            <p className="text-xs text-[#064d51]/60 mt-2">{helperText}</p>
          )}
        </div>
      </div>

      {/* Upload Progress */}
      {uploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#064d51]/70">Uploading...</span>
            <span className="text-[#064d51]/70">{uploadProgress}%</span>
          </div>
          <div className="h-2 bg-[#064d51]/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1e9c99] transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <svg
              className="h-5 w-5 text-green-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-green-800">
                Document uploaded successfully! Verification pending.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Button */}
      {selectedFile && !success && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full rounded-md bg-[#1e9c99] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#064d51] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? "Uploading..." : `Upload ${formatDocumentType(documentType)}`}
        </button>
      )}
    </div>
  );
}
