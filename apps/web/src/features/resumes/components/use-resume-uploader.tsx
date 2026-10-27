'use client';

import { ErrorCode, RESUME_MAX_PER_USER, type ResumeSummary } from '@offerleap/shared';
import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

import { isApiError } from '@/lib/api/errors';
import { useErrorText } from '@/lib/api/use-error-text';

import { resumesQuery, useUploadResume } from '../api/use-resumes';
import { prepareResumeFile } from '../compression/compress-image';
import { ReplaceOldestResumeDialog } from './ReplaceOldestResumeDialog';

export interface ResumeUploadCallbacks {
  onSuccess?: (resume: ResumeSummary) => void;
  /** Any failure except the CV limit, which opens the replace dialog instead. */
  onError?: (error: unknown) => void;
}

/** An upload waiting for the user to agree to delete `oldest`. */
interface PendingReplace {
  file: File;
  /** Whether `file` is already shrunk (the API refused it at the limit) or still as picked. */
  prepared: boolean;
  /** Name the user picked, shown in the dialog (a shrunk photo is renamed `.jpg`). */
  fileName: string;
  oldest: ResumeSummary;
  callbacks: ResumeUploadCallbacks;
}

/**
 * @description Uploads CVs, shrinking photos first (`prepareResumeFile`), and at the CV limit asks — in
 * `replaceDialog`, which the page renders — whether to delete the oldest CV to make room; confirming uploads with
 * that CV as `replaceId`, so the API swaps them in one step. The limit is checked on a fresh list *before* a photo
 * is shrunk, so a cancelled upload costs no compression. The API still has the last word: if it refuses at the
 * limit anyway (another tab uploaded meanwhile), the already shrunk file waits in the dialog and isn't shrunk
 * again. A file the user already has is accepted even at the limit (it comes back `reused`, deleting nothing).
 * @returns `mutate(file, callbacks)`, `isPending` and the dialog element.
 */
export function useResumeUploader(): {
  mutate: (file: File, callbacks?: ResumeUploadCallbacks) => void;
  isPending: boolean;
  replaceDialog: ReactNode;
} {
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const upload = useUploadResume();
  const [pending, setPending] = useState<PendingReplace | null>(null);
  /** Checking the list or shrinking a photo: work before the upload request itself. */
  const [preparing, setPreparing] = useState(false);

  /** Newest first, so the last CV is the oldest; null when the list can't be read (the API then decides). */
  const freshResumes = () => queryClient.fetchQuery({ ...resumesQuery, staleTime: 0 }).catch(() => null);

  function send(file: File, fileName: string, callbacks: ResumeUploadCallbacks) {
    upload.mutate(
      { file },
      {
        onSuccess: callbacks.onSuccess,
        onError: async (error) => {
          if (isApiError(error) && error.code === ErrorCode.RESUME_LIMIT_REACHED) {
            const oldest = (await freshResumes())?.at(-1);
            if (oldest) {
              upload.reset();
              setPending({ file, prepared: true, fileName, oldest, callbacks });
              return;
            }
          }
          callbacks.onError?.(error);
        },
      },
    );
  }

  async function mutate(file: File, callbacks: ResumeUploadCallbacks = {}) {
    setPreparing(true);
    try {
      const resumes = await freshResumes();
      if (resumes && resumes.length >= RESUME_MAX_PER_USER) {
        setPending({ file, prepared: false, fileName: file.name, oldest: resumes.at(-1)!, callbacks });
        return;
      }
      send((await prepareResumeFile(file)).file, file.name, callbacks);
    } finally {
      setPreparing(false);
    }
  }

  async function confirm() {
    if (!pending) return;
    setPreparing(true);
    try {
      const file = pending.prepared ? pending.file : (await prepareResumeFile(pending.file)).file;
      upload.mutate(
        { file, replaceId: pending.oldest.id },
        {
          onSuccess: (resume) => {
            setPending(null);
            pending.callbacks.onSuccess?.(resume);
          },
        },
      );
    } finally {
      setPreparing(false);
    }
  }

  function cancel() {
    setPending(null);
    upload.reset();
  }

  const busy = preparing || upload.isPending;
  return {
    mutate: (file, callbacks) => void mutate(file, callbacks),
    // While the dialog is open the page waits for the user, not for an upload.
    isPending: busy && !pending,
    replaceDialog: (
      <ReplaceOldestResumeDialog
        pending={pending && { fileName: pending.fileName, oldest: pending.oldest }}
        loading={busy}
        error={pending && upload.error ? errorText(upload.error) : undefined}
        onConfirm={() => void confirm()}
        onCancel={cancel}
      />
    ),
  };
}
