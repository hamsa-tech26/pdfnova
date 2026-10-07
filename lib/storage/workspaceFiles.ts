export type WorkspaceFileSummary = {
  id: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  savedAt: string;
};

type WorkspaceFileRecord =
  WorkspaceFileSummary & {
    blob: Blob;
  };

const DB_NAME =
  "kukureku-workspace-v1";
const STORE_NAME = "files";
const DB_VERSION = 1;

export const WORKSPACE_CHANGE_EVENT =
  "kukureku-workspace-change";

function assertBrowserStorage() {
  if (
    typeof window === "undefined" ||
    !("indexedDB" in window)
  ) {
    throw new Error(
      "Browser workspace storage is unavailable.",
    );
  }
}

function openWorkspaceDatabase(): Promise<IDBDatabase> {
  assertBrowserStorage();

  return new Promise(
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
              STORE_NAME,
            )
          ) {
            db.createObjectStore(
              STORE_NAME,
              {
                keyPath: "id",
              },
            );
          }
        };

      request.onsuccess = () =>
        resolve(request.result);

      request.onerror = () =>
        reject(
          request.error ??
            new Error(
              "Unable to open browser workspace storage.",
            ),
        );
    },
  );
}

function requestValue<T>(
  request: IDBRequest<T>,
): Promise<T> {
  return new Promise(
    (resolve, reject) => {
      request.onsuccess = () =>
        resolve(request.result);

      request.onerror = () =>
        reject(
          request.error ??
            new Error(
              "Browser workspace storage request failed.",
            ),
        );
    },
  );
}

function transactionComplete(
  transaction: IDBTransaction,
): Promise<void> {
  return new Promise(
    (resolve, reject) => {
      transaction.oncomplete =
        () => resolve();

      transaction.onerror = () =>
        reject(
          transaction.error ??
            new Error(
              "Browser workspace transaction failed.",
            ),
        );

      transaction.onabort = () =>
        reject(
          transaction.error ??
            new Error(
              "Browser workspace transaction was aborted.",
            ),
        );
    },
  );
}

function notifyWorkspaceChanged() {
  if (
    typeof window !== "undefined"
  ) {
    window.dispatchEvent(
      new Event(
        WORKSPACE_CHANGE_EVENT,
      ),
    );
  }
}

function toSummary(
  record: WorkspaceFileRecord,
): WorkspaceFileSummary {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    size: record.size,
    lastModified:
      record.lastModified,
    savedAt: record.savedAt,
  };
}

export async function saveActiveWorkspaceFile(
  file: File,
): Promise<WorkspaceFileSummary> {
  const db =
    await openWorkspaceDatabase();

  try {
    const readTransaction =
      db.transaction(
        STORE_NAME,
        "readonly",
      );
    const currentRecords =
      (await requestValue(
        readTransaction
          .objectStore(STORE_NAME)
          .getAll(),
      )) as WorkspaceFileRecord[];
    const current =
      currentRecords[0];

    const isSameSource =
      Boolean(current) &&
      current.name === file.name &&
      current.size === file.size &&
      current.lastModified ===
        file.lastModified &&
      current.type ===
        (file.type ||
          "application/pdf");

    const record: WorkspaceFileRecord =
      {
        id:
          isSameSource &&
          current
            ? current.id
            : crypto.randomUUID(),
        name: file.name,
        type:
          file.type ||
          "application/pdf",
        size: file.size,
        lastModified:
          file.lastModified,
        savedAt:
          isSameSource &&
          current
            ? current.savedAt
            : new Date().toISOString(),
        blob: file,
      };

    const transaction =
      db.transaction(
        STORE_NAME,
        "readwrite",
      );
    const store =
      transaction.objectStore(
        STORE_NAME,
      );

    store.clear();
    store.put(record);

    await transactionComplete(
      transaction,
    );

    notifyWorkspaceChanged();

    return toSummary(record);
  } finally {
    db.close();
  }
}

export async function getWorkspaceFile(
  id: string,
): Promise<File | null> {
  const db =
    await openWorkspaceDatabase();

  try {
    const transaction =
      db.transaction(
        STORE_NAME,
        "readonly",
      );
    const store =
      transaction.objectStore(
        STORE_NAME,
      );
    const record =
      (await requestValue(
        store.get(id),
      )) as
        | WorkspaceFileRecord
        | undefined;

    if (!record) {
      return null;
    }

    return new File(
      [record.blob],
      record.name,
      {
        type: record.type,
        lastModified:
          record.lastModified,
      },
    );
  } finally {
    db.close();
  }
}

export async function getActiveWorkspaceFileSummary(): Promise<
  WorkspaceFileSummary | null
> {
  const db =
    await openWorkspaceDatabase();

  try {
    const transaction =
      db.transaction(
        STORE_NAME,
        "readonly",
      );
    const store =
      transaction.objectStore(
        STORE_NAME,
      );
    const records =
      (await requestValue(
        store.getAll(),
      )) as WorkspaceFileRecord[];

    return records[0]
      ? toSummary(records[0])
      : null;
  } finally {
    db.close();
  }
}

export async function clearWorkspaceFiles() {
  const db =
    await openWorkspaceDatabase();

  try {
    const transaction =
      db.transaction(
        STORE_NAME,
        "readwrite",
      );

    transaction
      .objectStore(STORE_NAME)
      .clear();

    await transactionComplete(
      transaction,
    );

    notifyWorkspaceChanged();
  } finally {
    db.close();
  }
}

export function buildWorkspaceHandoffHref(
  route: string,
  workspaceFileId: string,
) {
  const separator =
    route.includes("?") ? "&" : "?";

  return (
    route +
    separator +
    "workspaceFile=" +
    encodeURIComponent(
      workspaceFileId,
    )
  );
}
