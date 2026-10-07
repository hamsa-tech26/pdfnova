import {
  clearWorkflowRecipeProgress,
} from "./workflowProgress";
import {
  createBranchLineage,
  createCompositionLineage,
  createDerivedLineage,
  createSourceLineage,
  isSameWorkspaceFileFingerprint,
  normalizeWorkspaceLineage,
  type WorkspaceFileRole,
  type WorkspaceOperationDescriptor,
  type WorkspaceRelationKind,
} from "./workspaceLineage";

export type WorkspaceFileSummary = {
  id: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  savedAt: string;
  role: WorkspaceFileRole;
  parentId: string | null;
  parentIds: string[];
  rootId: string;
  rootIds: string[];
  documentId: string;
  relationKind: WorkspaceRelationKind;
  operationId: string | null;
  operationLabel: string | null;
  version: number;
  generation: number;
};

type WorkspaceFileRecord =
  WorkspaceFileSummary & {
    blob: Blob;
  };

type WorkspaceMetaRecord = {
  key: string;
  value: string;
};

const DB_NAME =
  "kukureku-workspace-v1";
const FILE_STORE = "files";
const SUMMARY_STORE = "summaries";
const META_STORE = "meta";
const ACTIVE_FILE_KEY =
  "active-file-id";
const DB_VERSION = 3;

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

function normalizeRecord(
  record: WorkspaceFileRecord,
): WorkspaceFileRecord {
  return {
    ...record,
    type:
      record.type ||
      "application/pdf",
    ...normalizeWorkspaceLineage(
      record,
    ),
  };
}

function toSummary(
  record: WorkspaceFileRecord,
): WorkspaceFileSummary {
  const normalized =
    normalizeRecord(record);

  return {
    id: normalized.id,
    name: normalized.name,
    type: normalized.type,
    size: normalized.size,
    lastModified:
      normalized.lastModified,
    savedAt: normalized.savedAt,
    role: normalized.role,
    parentId:
      normalized.parentId,
    parentIds: [
      ...normalized.parentIds,
    ],
    rootId: normalized.rootId,
    rootIds: [
      ...normalized.rootIds,
    ],
    documentId:
      normalized.documentId,
    relationKind:
      normalized.relationKind,
    operationId:
      normalized.operationId,
    operationLabel:
      normalized.operationLabel,
    version: normalized.version,
    generation:
      normalized.generation,
  };
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
        (event) => {
          const db =
            request.result;
          const transaction =
            request.transaction;

          if (!transaction) {
            return;
          }

          let fileStore:
            | IDBObjectStore
            | null = null;

          if (
            !db.objectStoreNames.contains(
              FILE_STORE,
            )
          ) {
            fileStore =
              db.createObjectStore(
                FILE_STORE,
                {
                  keyPath: "id",
                },
              );
          } else {
            fileStore =
              transaction.objectStore(
                FILE_STORE,
              );
          }

          if (
            !db.objectStoreNames.contains(
              SUMMARY_STORE,
            )
          ) {
            db.createObjectStore(
              SUMMARY_STORE,
              {
                keyPath: "id",
              },
            );
          }

          if (
            !db.objectStoreNames.contains(
              META_STORE,
            )
          ) {
            db.createObjectStore(
              META_STORE,
              {
                keyPath: "key",
              },
            );
          }

          if (
            event.oldVersion > 0 &&
            event.oldVersion < 3 &&
            fileStore
          ) {
            const summaryStore =
              transaction.objectStore(
                SUMMARY_STORE,
              );
            const metaStore =
              transaction.objectStore(
                META_STORE,
              );
            const cursorRequest =
              fileStore.openCursor();

            cursorRequest.onsuccess =
              () => {
                const cursor =
                  cursorRequest.result;

                if (!cursor) {
                  return;
                }

                const legacy =
                  cursor.value as WorkspaceFileRecord;
                const normalized =
                  normalizeRecord(
                    legacy,
                  );

                cursor.update(
                  normalized,
                );
                summaryStore.put(
                  toSummary(
                    normalized,
                  ),
                );

                if (
                  event.oldVersion <
                  2
                ) {
                  metaStore.put({
                    key: ACTIVE_FILE_KEY,
                    value:
                      normalized.id,
                  });
                }

                cursor.continue();
              };
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

async function readAllSummaries(
  db: IDBDatabase,
) {
  const transaction =
    db.transaction(
      SUMMARY_STORE,
      "readonly",
    );
  const summaries =
    (await requestValue(
      transaction
        .objectStore(
          SUMMARY_STORE,
        )
        .getAll(),
    )) as WorkspaceFileSummary[];

  return summaries
    .map((summary) => ({
      ...summary,
      ...normalizeWorkspaceLineage(
        summary,
      ),
    }))
    .sort((left, right) =>
      left.savedAt.localeCompare(
        right.savedAt,
      ),
    );
}

async function readActiveFileId(
  db: IDBDatabase,
) {
  const transaction =
    db.transaction(
      META_STORE,
      "readonly",
    );
  const record =
    (await requestValue(
      transaction
        .objectStore(META_STORE)
        .get(ACTIVE_FILE_KEY),
    )) as
      | WorkspaceMetaRecord
      | undefined;

  return record?.value ?? null;
}

async function writeActiveFileId(
  db: IDBDatabase,
  id: string,
) {
  const transaction =
    db.transaction(
      META_STORE,
      "readwrite",
    );

  transaction
    .objectStore(META_STORE)
    .put({
      key: ACTIVE_FILE_KEY,
      value: id,
    });

  await transactionComplete(
    transaction,
  );
}

async function writeWorkspaceRecord(
  db: IDBDatabase,
  record: WorkspaceFileRecord,
  activate: boolean,
) {
  const stores = activate
    ? [
        FILE_STORE,
        SUMMARY_STORE,
        META_STORE,
      ]
    : [
        FILE_STORE,
        SUMMARY_STORE,
      ];
  const transaction =
    db.transaction(
      stores,
      "readwrite",
    );

  transaction
    .objectStore(FILE_STORE)
    .put(record);
  transaction
    .objectStore(
      SUMMARY_STORE,
    )
    .put(
      toSummary(record),
    );

  if (activate) {
    transaction
      .objectStore(META_STORE)
      .put({
        key: ACTIVE_FILE_KEY,
        value: record.id,
      });
  }

  await transactionComplete(
    transaction,
  );
}

export async function findWorkspaceFileSummaryByFingerprint(
  file: File,
): Promise<WorkspaceFileSummary | null> {
  const db =
    await openWorkspaceDatabase();

  try {
    const summaries =
      await readAllSummaries(db);

    return (
      summaries.find(
        (summary) =>
          isSameWorkspaceFileFingerprint(
            summary,
            file,
          ),
      ) ?? null
    );
  } finally {
    db.close();
  }
}

export async function ensureWorkspaceSourceFile(
  file: File,
  options: {
    activate?: boolean;
  } = {},
): Promise<WorkspaceFileSummary> {
  const activate =
    options.activate ?? false;
  const db =
    await openWorkspaceDatabase();

  try {
    const summaries =
      await readAllSummaries(db);
    const existing =
      summaries.find(
        (summary) =>
          isSameWorkspaceFileFingerprint(
            summary,
            file,
          ),
      );

    if (existing) {
      if (activate) {
        await writeActiveFileId(
          db,
          existing.id,
        );
        notifyWorkspaceChanged();
      }

      return existing;
    }

    const id =
      crypto.randomUUID();
    const record: WorkspaceFileRecord =
      {
        id,
        name: file.name,
        type:
          file.type ||
          "application/pdf",
        size: file.size,
        lastModified:
          file.lastModified,
        savedAt:
          new Date().toISOString(),
        ...createSourceLineage(
          id,
        ),
        blob: file,
      };

    await writeWorkspaceRecord(
      db,
      record,
      activate,
    );
    notifyWorkspaceChanged();

    return toSummary(
      record,
    );
  } finally {
    db.close();
  }
}

export async function saveActiveWorkspaceFile(
  file: File,
): Promise<WorkspaceFileSummary> {
  return ensureWorkspaceSourceFile(
    file,
    {
      activate: true,
    },
  );
}

export async function saveDerivedWorkspaceFile(
  file: File,
  options: {
    parentId: string;
  } & WorkspaceOperationDescriptor,
): Promise<WorkspaceFileSummary> {
  const db =
    await openWorkspaceDatabase();

  try {
    const summaries =
      await readAllSummaries(db);
    const parent =
      summaries.find(
        (summary) =>
          summary.id ===
          options.parentId,
      );

    if (!parent) {
      throw new Error(
        "The parent browser workspace version is no longer available.",
      );
    }

    const nextVersion =
      summaries
        .filter(
          (summary) =>
            summary.documentId ===
            parent.documentId,
        )
        .reduce(
          (highest, summary) =>
            Math.max(
              highest,
              summary.version,
            ),
          0,
        ) + 1;
    const id =
      crypto.randomUUID();
    const record: WorkspaceFileRecord =
      {
        id,
        name: file.name,
        type:
          file.type ||
          "application/pdf",
        size: file.size,
        lastModified:
          file.lastModified,
        savedAt:
          new Date().toISOString(),
        ...createDerivedLineage(
          parent,
          nextVersion,
          {
            operationId:
              options.operationId,
            operationLabel:
              options.operationLabel,
          },
        ),
        blob: file,
      };

    await writeWorkspaceRecord(
      db,
      record,
      true,
    );
    notifyWorkspaceChanged();

    return toSummary(
      record,
    );
  } finally {
    db.close();
  }
}

export async function saveBranchedWorkspaceFile(
  file: File,
  options: {
    parentId: string;
  } & WorkspaceOperationDescriptor,
): Promise<WorkspaceFileSummary> {
  const db =
    await openWorkspaceDatabase();

  try {
    const summaries =
      await readAllSummaries(db);
    const parent =
      summaries.find(
        (summary) =>
          summary.id ===
          options.parentId,
      );

    if (!parent) {
      throw new Error(
        "The parent browser workspace document is no longer available.",
      );
    }

    const id =
      crypto.randomUUID();
    const record: WorkspaceFileRecord =
      {
        id,
        name: file.name,
        type:
          file.type ||
          "application/pdf",
        size: file.size,
        lastModified:
          file.lastModified,
        savedAt:
          new Date().toISOString(),
        ...createBranchLineage(
          parent,
          id,
          {
            operationId:
              options.operationId,
            operationLabel:
              options.operationLabel,
          },
        ),
        blob: file,
      };

    await writeWorkspaceRecord(
      db,
      record,
      true,
    );
    notifyWorkspaceChanged();

    return toSummary(
      record,
    );
  } finally {
    db.close();
  }
}

export async function saveComposedWorkspaceFile(
  file: File,
  options: {
    parentIds: string[];
  } & WorkspaceOperationDescriptor,
): Promise<WorkspaceFileSummary> {
  if (
    options.parentIds.length < 2
  ) {
    throw new Error(
      "A composed workspace document requires at least two parent documents.",
    );
  }

  const db =
    await openWorkspaceDatabase();

  try {
    const summaries =
      await readAllSummaries(db);
    const byId =
      new Map(
        summaries.map(
          (summary) => [
            summary.id,
            summary,
          ],
        ),
      );
    const parents =
      options.parentIds.map(
        (id) =>
          byId.get(id),
      );

    if (
      parents.some(
        (parent) =>
          !parent,
      )
    ) {
      throw new Error(
        "One or more parent browser workspace documents are no longer available.",
      );
    }

    const id =
      crypto.randomUUID();
    const record: WorkspaceFileRecord =
      {
        id,
        name: file.name,
        type:
          file.type ||
          "application/pdf",
        size: file.size,
        lastModified:
          file.lastModified,
        savedAt:
          new Date().toISOString(),
        ...createCompositionLineage(
          parents as WorkspaceFileSummary[],
          id,
          {
            operationId:
              options.operationId,
            operationLabel:
              options.operationLabel,
          },
        ),
        blob: file,
      };

    await writeWorkspaceRecord(
      db,
      record,
      true,
    );
    notifyWorkspaceChanged();

    return toSummary(
      record,
    );
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
        FILE_STORE,
        "readonly",
      );
    const record =
      (await requestValue(
        transaction
          .objectStore(FILE_STORE)
          .get(id),
      )) as
        | WorkspaceFileRecord
        | undefined;

    if (!record) {
      return null;
    }

    const normalized =
      normalizeRecord(record);

    return new File(
      [normalized.blob],
      normalized.name,
      {
        type: normalized.type,
        lastModified:
          normalized.lastModified,
      },
    );
  } finally {
    db.close();
  }
}

export async function getWorkspaceFileSummary(
  id: string,
): Promise<WorkspaceFileSummary | null> {
  const db =
    await openWorkspaceDatabase();

  try {
    const transaction =
      db.transaction(
        SUMMARY_STORE,
        "readonly",
      );
    const summary =
      (await requestValue(
        transaction
          .objectStore(
            SUMMARY_STORE,
          )
          .get(id),
      )) as
        | WorkspaceFileSummary
        | undefined;

    if (!summary) {
      return null;
    }

    return {
      ...summary,
      ...normalizeWorkspaceLineage(
        summary,
      ),
    };
  } finally {
    db.close();
  }
}

export async function listWorkspaceFileSummaries(): Promise<
  WorkspaceFileSummary[]
> {
  const db =
    await openWorkspaceDatabase();

  try {
    return await readAllSummaries(
      db,
    );
  } finally {
    db.close();
  }
}

export async function setActiveWorkspaceFile(
  id: string,
) {
  const db =
    await openWorkspaceDatabase();

  try {
    const transaction =
      db.transaction(
        SUMMARY_STORE,
        "readonly",
      );
    const summary =
      await requestValue(
        transaction
          .objectStore(
            SUMMARY_STORE,
          )
          .get(id),
      );

    if (!summary) {
      throw new Error(
        "This browser workspace document is no longer available.",
      );
    }

    await writeActiveFileId(
      db,
      id,
    );
    notifyWorkspaceChanged();
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
    const activeId =
      await readActiveFileId(
        db,
      );
    const summaries =
      await readAllSummaries(
        db,
      );

    if (!summaries.length) {
      return null;
    }

    if (activeId) {
      const active =
        summaries.find(
          (summary) =>
            summary.id ===
            activeId,
        );

      if (active) {
        return active;
      }
    }

    return (
      summaries[
        summaries.length - 1
      ] ?? null
    );
  } finally {
    db.close();
  }
}

export async function clearWorkspaceFiles() {
  clearWorkflowRecipeProgress();

  const db =
    await openWorkspaceDatabase();

  try {
    const transaction =
      db.transaction(
        [
          FILE_STORE,
          SUMMARY_STORE,
          META_STORE,
        ],
        "readwrite",
      );

    transaction
      .objectStore(FILE_STORE)
      .clear();
    transaction
      .objectStore(
        SUMMARY_STORE,
      )
      .clear();
    transaction
      .objectStore(META_STORE)
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

export function buildWorkspaceMultiHandoffHref(
  route: string,
  workspaceFileIds: string[],
) {
  const uniqueIds = [
    ...new Set(
      workspaceFileIds.filter(
        Boolean,
      ),
    ),
  ];

  if (uniqueIds.length === 0) {
    return route;
  }

  const separator =
    route.includes("?") ? "&" : "?";

  return (
    route +
    separator +
    "workspaceFiles=" +
    encodeURIComponent(
      uniqueIds.join(","),
    )
  );
}
