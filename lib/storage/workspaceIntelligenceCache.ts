import type {
  PdfContentSignal,
  WorkspaceEvidenceIndex,
  WorkspaceFact,
} from "@/lib/document-engine";
import type {
  WorkspaceFileSummary,
} from "./workspaceFiles";

export type WorkspaceIntelligenceCacheRecord = {
  nodeId: string;
  fingerprint: string;
  signal: PdfContentSignal;
  index: WorkspaceEvidenceIndex;
  facts: WorkspaceFact[];
  cachedAt: string;
  schemaVersion: 2;
};

export type WorkspaceIntelligenceCacheStats = {
  recordCount: number;
  pageCount: number;
  chunkCount: number;
  ocrPageCount: number;
  estimatedTextCharacters: number;
};

const DB_NAME =
  "kukureku-private-intelligence-v2";
const STORE = "records";
const DB_VERSION = 1;
const SETTINGS_KEY =
  "kukureku-private-intelligence-settings-v2";

function fingerprint(
  summary: Pick<
    WorkspaceFileSummary,
    | "id"
    | "name"
    | "size"
    | "lastModified"
  >,
) {
  return [
    summary.id,
    summary.name,
    summary.size,
    summary.lastModified,
  ].join(":");
}

function openDb() {
  if (
    typeof window ===
      "undefined" ||
    !("indexedDB" in window)
  ) {
    return Promise.reject(
      new Error(
        "Browser intelligence cache is unavailable.",
      ),
    );
  }

  return new Promise<IDBDatabase>(
    (resolve, reject) => {
      const request =
        window.indexedDB.open(
          DB_NAME,
          DB_VERSION,
        );

      request.onupgradeneeded =
        () => {
          const db =
            request.result;

          if (
            !db.objectStoreNames.contains(
              STORE,
            )
          ) {
            db.createObjectStore(
              STORE,
              {
                keyPath:
                  "nodeId",
              },
            );
          }
        };

      request.onsuccess =
        () =>
          resolve(
            request.result,
          );
      request.onerror =
        () =>
          reject(
            request.error ??
              new Error(
                "Unable to open intelligence cache.",
              ),
          );
    },
  );
}

function requestValue<T>(
  request: IDBRequest<T>,
) {
  return new Promise<T>(
    (resolve, reject) => {
      request.onsuccess =
        () =>
          resolve(
            request.result,
          );
      request.onerror =
        () =>
          reject(
            request.error ??
              new Error(
                "Intelligence cache request failed.",
              ),
          );
    },
  );
}

function transactionDone(
  transaction: IDBTransaction,
) {
  return new Promise<void>(
    (resolve, reject) => {
      transaction.oncomplete =
        () => resolve();
      transaction.onerror =
        () =>
          reject(
            transaction.error ??
              new Error(
                "Intelligence cache transaction failed.",
              ),
          );
      transaction.onabort =
        () =>
          reject(
            transaction.error ??
              new Error(
                "Intelligence cache transaction was aborted.",
              ),
          );
    },
  );
}

export function workspaceIntelligenceFingerprint(
  summary: WorkspaceFileSummary,
) {
  return fingerprint(
    summary,
  );
}

export async function getWorkspaceIntelligenceCacheRecord(
  summary: WorkspaceFileSummary,
): Promise<WorkspaceIntelligenceCacheRecord | null> {
  const db =
    await openDb();

  try {
    const tx =
      db.transaction(
        STORE,
        "readonly",
      );
    const record =
      (await requestValue(
        tx
          .objectStore(STORE)
          .get(summary.id),
      )) as
        | WorkspaceIntelligenceCacheRecord
        | undefined;

    if (
      !record ||
      record.schemaVersion !==
        2 ||
      record.fingerprint !==
        fingerprint(summary)
    ) {
      return null;
    }

    return record;
  } finally {
    db.close();
  }
}

export async function saveWorkspaceIntelligenceCacheRecord(
  summary: WorkspaceFileSummary,
  input: Omit<
    WorkspaceIntelligenceCacheRecord,
    | "nodeId"
    | "fingerprint"
    | "cachedAt"
    | "schemaVersion"
  >,
) {
  const db =
    await openDb();

  try {
    const tx =
      db.transaction(
        STORE,
        "readwrite",
      );

    tx.objectStore(
      STORE,
    ).put({
      nodeId:
        summary.id,
      fingerprint:
        fingerprint(
          summary,
        ),
      ...input,
      cachedAt:
        new Date().toISOString(),
      schemaVersion: 2,
    } satisfies WorkspaceIntelligenceCacheRecord);

    await transactionDone(
      tx,
    );
  } finally {
    db.close();
  }
}

export async function pruneWorkspaceIntelligenceCache(
  validNodeIds: string[],
) {
  const db =
    await openDb();

  try {
    const tx =
      db.transaction(
        STORE,
        "readwrite",
      );
    const store =
      tx.objectStore(
        STORE,
      );
    const records =
      (await requestValue(
        store.getAll(),
      )) as WorkspaceIntelligenceCacheRecord[];
    const valid =
      new Set(
        validNodeIds,
      );

    for (const record of records) {
      if (
        !valid.has(
          record.nodeId,
        )
      ) {
        store.delete(
          record.nodeId,
        );
      }
    }

    await transactionDone(
      tx,
    );
  } finally {
    db.close();
  }
}

export async function getWorkspaceIntelligenceCacheStats(): Promise<WorkspaceIntelligenceCacheStats> {
  const db =
    await openDb();

  try {
    const tx =
      db.transaction(
        STORE,
        "readonly",
      );
    const records =
      (await requestValue(
        tx
          .objectStore(STORE)
          .getAll(),
      )) as WorkspaceIntelligenceCacheRecord[];

    return records.reduce(
      (stats, record) => {
        stats.recordCount +=
          1;
        stats.pageCount +=
          record.index
            .coverage
            .pageCount;
        stats.chunkCount +=
          record.index
            .coverage
            .chunkCount;
        stats.ocrPageCount +=
          (
            record.signal
              .pages ?? []
          ).filter(
            (page) =>
              page.source ===
              "ocr-tesseract",
          ).length;
        stats.estimatedTextCharacters +=
          record.signal
            .rawText
            ?.length ?? 0;
        return stats;
      },
      {
        recordCount: 0,
        pageCount: 0,
        chunkCount: 0,
        ocrPageCount: 0,
        estimatedTextCharacters: 0,
      },
    );
  } finally {
    db.close();
  }
}

export async function clearWorkspaceIntelligenceCache() {
  const db =
    await openDb();

  try {
    const tx =
      db.transaction(
        STORE,
        "readwrite",
      );
    tx.objectStore(
      STORE,
    ).clear();
    await transactionDone(
      tx,
    );
  } finally {
    db.close();
  }
}

export function loadWorkspaceIntelligenceSettings<T>(
  fallback: T,
): T {
  if (
    typeof window ===
    "undefined"
  ) {
    return fallback;
  }

  try {
    const value =
      window.localStorage.getItem(
        SETTINGS_KEY,
      );

    return value
      ? {
          ...fallback,
          ...JSON.parse(
            value,
          ),
        }
      : fallback;
  } catch {
    return fallback;
  }
}

export function saveWorkspaceIntelligenceSettings(
  value: unknown,
) {
  if (
    typeof window !==
    "undefined"
  ) {
    window.localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify(
        value,
      ),
    );
  }
}
