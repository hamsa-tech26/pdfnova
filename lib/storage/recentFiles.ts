export type RecentFileItem = {
  id: string;
  fileName: string;
  toolName: string;
  createdAt: string;
};

const STORAGE_KEY = "pdfnova-recent-files";
const MAX_RECENT_FILES = 8;

export function getRecentFiles(): RecentFileItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY);

    if (!storedValue) {
      return [];
    }

    const parsedValue = JSON.parse(storedValue);

    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
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

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(updatedItems),
  );

  return updatedItems;
}

export function clearRecentFiles() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}