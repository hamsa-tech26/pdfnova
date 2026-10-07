"use client";

import {
  groupWorkspaceDocuments,
} from "@/lib/storage/workspaceGraph";
import {
  getWorkspaceFile,
  listWorkspaceFileSummaries,
  WORKSPACE_CHANGE_EVENT,
  type WorkspaceFileSummary,
} from "@/lib/storage/workspaceFiles";
import {
  FolderPlus,
} from "lucide-react";
import {
  type RefObject,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

function sameFile(
  left: File,
  right: WorkspaceFileSummary,
) {
  return (
    left.name ===
      right.name &&
    left.size ===
      right.size &&
    left.lastModified ===
      right.lastModified &&
    (left.type ||
      "application/pdf") ===
      (right.type ||
        "application/pdf")
  );
}

export default function WorkspaceMergeSources({
  fileInputRef,
  selectedFiles,
}: Readonly<{
  fileInputRef: RefObject<HTMLInputElement | null>;
  selectedFiles: File[];
}>) {
  const [
    summaries,
    setSummaries,
  ] = useState<
    WorkspaceFileSummary[]
  >([]);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const next =
          await listWorkspaceFileSummaries();

        if (!cancelled) {
          setSummaries(next);
        }
      } catch {
        if (!cancelled) {
          setSummaries([]);
        }
      }
    }

    void refresh();

    const onChange = () =>
      void refresh();

    window.addEventListener(
      WORKSPACE_CHANGE_EVENT,
      onChange,
    );

    return () => {
      cancelled = true;
      window.removeEventListener(
        WORKSPACE_CHANGE_EVENT,
        onChange,
      );
    };
  }, []);

  const documents =
    useMemo(
      () =>
        groupWorkspaceDocuments(
          summaries,
        ),
      [summaries],
    );

  if (!documents.length) {
    return null;
  }

  async function addDocument(
    summary: WorkspaceFileSummary,
  ) {
    if (
      selectedFiles.some(
        (file) =>
          sameFile(
            file,
            summary,
          ),
      )
    ) {
      toast(
        "Already selected",
        {
          description:
            summary.name,
        },
      );
      return;
    }

    const file =
      await getWorkspaceFile(
        summary.id,
      );

    if (!file) {
      toast.error(
        "This workspace document is no longer available.",
      );
      return;
    }

    const input =
      fileInputRef.current;

    if (!input) {
      toast.error(
        "The merge uploader is not ready.",
      );
      return;
    }

    const transfer =
      new DataTransfer();
    transfer.items.add(file);
    input.files =
      transfer.files;
    input.dispatchEvent(
      new Event("change", {
        bubbles: true,
      }),
    );
  }

  return (
    <section className="mt-6 rounded-3xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-900 dark:bg-violet-950/20">
      <div className="flex items-start gap-3">
        <FolderPlus
          size={21}
          className="mt-0.5 shrink-0 text-violet-700 dark:text-violet-300"
        />
        <div>
          <p className="font-extrabold text-violet-950 dark:text-violet-100">
            Add from browser workspace
          </p>
          <p className="mt-1 text-sm leading-6 text-violet-800 dark:text-violet-200">
            Reuse any saved workspace document without downloading and uploading it again.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {documents.map(
          (document) => {
            const alreadySelected =
              selectedFiles.some(
                (file) =>
                  sameFile(
                    file,
                    document.head,
                  ),
              );

            return (
              <button
                key={
                  document.documentId
                }
                type="button"
                disabled={
                  alreadySelected
                }
                onClick={() =>
                  void addDocument(
                    document.head,
                  )
                }
                className="max-w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-left text-xs font-bold text-violet-800 transition hover:bg-violet-100 disabled:cursor-default disabled:opacity-50 dark:border-violet-900 dark:bg-slate-950 dark:text-violet-200"
              >
                <span className="block max-w-56 truncate">
                  {
                    document.head
                      .name
                  }
                </span>
                <span className="mt-0.5 block font-medium opacity-70">
                  {alreadySelected
                    ? "Already selected"
                    : "Add latest version"}
                </span>
              </button>
            );
          },
        )}
      </div>
    </section>
  );
}
