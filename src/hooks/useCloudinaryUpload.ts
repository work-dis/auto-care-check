'use client';

import { useState, useCallback } from 'react';

interface UseCloudinaryUploadReturn {
  /** Upload a file to Cloudinary via /api/upload. Returns the URL when done. */
  upload: (file: File) => Promise<string | null>;
  /** True while upload is in progress */
  uploading: boolean;
  /** Error message if upload failed, or null */
  error: string | null;
}

/**
 * Hook for uploading images to Cloudinary.
 *
 * Используй: const { upload, uploading } = useCloudinaryUpload()
 * — передай File, получи url (string | null)
 *
 * Example:
 *   const { upload, uploading, error } = useCloudinaryUpload();
 *   const url = await upload(fileInput.files[0]);
 */
export function useCloudinaryUpload(): UseCloudinaryUploadReturn {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File): Promise<string | null> => {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Upload failed');
      }

      const data = await response.json();
      return data.url as string;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown upload error';
      setError(message);
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  return { upload, uploading, error };
}
