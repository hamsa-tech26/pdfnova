export type RecentFileItem = {
  id: string;
  fileName: string;
  toolName: string;
  createdAt: string;
};

const STORAGE_KEY = "kukureku-recent-files";
const MAX_RECENT_FILES = 8;
const HISTORY_EVENT = "kukureku-history-change";
const EMPTY_HISTORY: RecentFileItem[] = [];
let cachedValue: string | null = null;
let cachedItems = EMPTY_HISTORY;

export function getServerRecentFiles(): RecentFileItem[] {
  return EMPTY_HISTORY;
}

export function subscribeRecentFiles(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(HISTORY_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(HISTORY_EVENT, onChange);
  };
}

function isRecentFile(value: unknown): value is RecentFileItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<RecentFileItem>;
  return typeof item.id === "string" &&
    typeof item.fileName === "string" &&
    typeof item.toolName === "string" &&
    typeof item.createdAt === "string";
}

export function getRecentFiles(): RecentFileItem[] {
  if (typeof window === "undefined") {
    return EMPTY_HISTORY;
  }

  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    if (storedValue === cachedValue) return cachedItems;

    if (!storedValue) {
      cachedValue = null;
      cachedItems = EMPTY_HISTORY;
      return cachedItems;
    }

    const parsedValue = JSON.parse(storedValue);

    cachedItems = Array.isArray(parsedValue)
      ? parsedValue.filter(isRecentFile).slice(0, MAX_RECENT_FILES)
      : EMPTY_HISTORY;
    cachedValue = storedValue;
    return cachedItems;
  } catch {
    return EMPTY_HISTORY;
  }
}

export function addRecentFile(
  item: Omit<RecentFileItem, "id" | "createdAt">,
): RecentFileItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  const newItem: RecentFileItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  const updatedItems = [
    newItem,
    ...getRecentFiles(),
  ].slice(0, MAX_RECENT_FILES);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedItems));
    window.dispatchEvent(new Event(HISTORY_EVENT));
  } catch {
    // Optional history must never turn a successful conversion into a failure.
  }

  return updatedItems;
}

export function clearRecentFiles() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(HISTORY_EVENT));
  } catch {
    // Storage can be disabled by browser privacy settings.
  }
}
