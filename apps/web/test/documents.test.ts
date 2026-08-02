import { describe, expect, it, vi } from "vitest";
import {
  MAX_DOCUMENT_BYTES,
  isAllowedUploadType,
  validateDocumentUpload,
} from "@planned/shared";
import {
  deleteDocumentWithRollback,
  putDocumentWithMetadata,
} from "../src/server/document-storage";

describe("document upload validation", () => {
  it.each([
    [{ size: 0, type: "application/pdf" }, "empty_file"],
    [{ size: MAX_DOCUMENT_BYTES + 1, type: "application/pdf" }, "file_too_large"],
    [{ size: 10, type: "text/html" }, "unsupported_type"],
    [{ size: 10, type: "application/octet-stream" }, "unsupported_type"],
  ] as const)("rejects %s", (file, error) => {
    expect(validateDocumentUpload(file)).toBe(error);
  });

  it("accepts a supported document type", () => {
    expect(isAllowedUploadType("application/pdf")).toBe(true);
    expect(validateDocumentUpload({ size: 10, type: "application/pdf" })).toBeNull();
  });
});

function fakeStore() {
  return {
    put: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  };
}

describe("document storage consistency", () => {
  it("removes the R2 object when D1 metadata insert fails", async () => {
    const store = fakeStore();
    const error = new Error("d1 unavailable");

    await expect(
      putDocumentWithMetadata({
        store,
        key: "trip/doc",
        file: new Blob(["file"]),
        options: {},
        insert: async () => {
          throw error;
        },
      }),
    ).rejects.toBe(error);

    expect(store.put).toHaveBeenCalledOnce();
    expect(store.delete).toHaveBeenCalledWith("trip/doc");
  });

  it("restores D1 metadata when R2 deletion fails", async () => {
    const store = fakeStore();
    const document = { id: "doc", r2Key: "trip/doc" };
    const restore = vi.fn(async () => undefined);
    store.delete.mockRejectedValueOnce(new Error("r2 unavailable"));

    await expect(
      deleteDocumentWithRollback({
        store,
        key: document.r2Key,
        remove: async () => document,
        restore,
      }),
    ).rejects.toThrow("r2 unavailable");

    expect(restore).toHaveBeenCalledWith(document);
  });
});
