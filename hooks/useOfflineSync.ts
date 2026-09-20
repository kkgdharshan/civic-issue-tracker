'use client';

import { useEffect, useState, useCallback } from 'react';
import { localDB } from '@/lib/db/indexed-db';
import { useQueryClient } from '@tanstack/react-query';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const queryClient = useQueryClient();

  const refreshPendingCount = useCallback(async () => {
    try {
      const items = await localDB.getAllPending();
      setPendingCount(items.length);
    } catch {
      // IndexedDB unavailable or SSR
    }
  }, []);

  const triggerDrainQueue = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;

    try {
      setIsSyncing(true);
      const pendingItems = await localDB.getAllPending();
      if (pendingItems.length === 0) return;

      for (const item of pendingItems) {
        try {
          await localDB.updateStatus(item.localId, 'SYNCING');

          let uploadedMediaUrls: string[] = [];

          // 1. Upload cached image blob if present
          if (item.imageBlob) {
            const presignRes = await fetch('/api/uploads/presigned-url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contentType: 'image/jpeg',
                fileSizeBytes: item.imageBlob.size,
              }),
            });

            if (presignRes.ok) {
              const { uploadUrl, publicUrl } = await presignRes.json();
              const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                body: item.imageBlob,
                headers: { 'Content-Type': 'image/jpeg' },
              });
              if (uploadRes.ok) {
                uploadedMediaUrls.push(publicUrl);
              }
            }
          }

          // 2. Submit issue with idempotency key
          const submitRes = await fetch('/api/issues', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': item.localId,
            },
            body: JSON.stringify({
              ...item.payload,
              mediaUrls: uploadedMediaUrls,
            }),
          });

          if (submitRes.ok) {
            await localDB.remove(item.localId);
          } else {
            const errJson = await submitRes.json();
            await localDB.updateStatus(item.localId, 'FAILED', errJson.message);
          }
        } catch (itemError: unknown) {
          const message = itemError instanceof Error ? itemError.message : 'Network error';
          await localDB.updateStatus(item.localId, 'FAILED', message);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['issues'] });
    } finally {
      setIsSyncing(false);
      await refreshPendingCount();
    }
  }, [isSyncing, queryClient, refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      triggerDrainQueue();
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerDrainQueue, refreshPendingCount]);

  return { isOnline, pendingCount, isSyncing, triggerDrainQueue, refreshPendingCount };
}
