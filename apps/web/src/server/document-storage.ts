/**
 * Small compensation helpers for the non-transactional R2 + D1 document
 * boundary. R2 and D1 cannot commit atomically, so every completed side gets
 * a best-effort rollback when the other side fails.
 */

export interface DocumentObjectStore {
  put(key: string, value: Blob, options: unknown): Promise<unknown>;
  delete(key: string): Promise<void>;
}

export async function putDocumentWithMetadata<T>(input: {
  store: DocumentObjectStore;
  key: string;
  file: Blob;
  options: unknown;
  insert: () => Promise<T>;
}): Promise<T> {
  await input.store.put(input.key, input.file, input.options);
  try {
    return await input.insert();
  } catch (error) {
    try {
      await input.store.delete(input.key);
    } catch (cleanupError) {
      console.error("Document upload rollback failed", cleanupError);
    }
    throw error;
  }
}

export async function deleteDocumentWithRollback<T>(input: {
  store: DocumentObjectStore;
  key: string;
  remove: () => Promise<T>;
  restore: (value: T) => Promise<void>;
}): Promise<T> {
  const removed = await input.remove();
  try {
    await input.store.delete(input.key);
    return removed;
  } catch (error) {
    try {
      await input.restore(removed);
    } catch (restoreError) {
      console.error("Document delete rollback failed", restoreError);
    }
    throw error;
  }
}
