"use client";

import {
  getWorkspaceFile,
  setActiveWorkspaceFile,
} from "@/lib/storage/workspaceFiles";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const QUERY_KEY =
  "workspaceFile";
const MULTI_QUERY_KEY =
  "workspaceFiles";

const DIRECT_WORKSPACE_ROUTES = [
  "/workflow-recipes",
  "/compare-documents",
];

function findFileInput() {
  return document.querySelector(
    'input[type="file"]:not([disabled])',
  ) as HTMLInputElement | null;
}

function injectFiles(
  input: HTMLInputElement,
  files: File[],
  workspaceFileIds: string[],
) {
  const transfer =
    new DataTransfer();

  for (const file of files) {
    transfer.items.add(file);
  }

  input.files =
    transfer.files;

  if (
    workspaceFileIds.length ===
    1
  ) {
    input.dataset.workspaceFileId =
      workspaceFileIds[0];
  } else {
    input.dataset.workspaceFileIds =
      workspaceFileIds.join(",");
  }

  input.dispatchEvent(
    new Event("change", {
      bubbles: true,
    }),
  );
}

function parseWorkspaceFileIds() {
  const params =
    new URLSearchParams(
      window.location.search,
    );
  const multi =
    (params.get(
      MULTI_QUERY_KEY,
    ) ?? "")
      .split(",")
      .map((value) =>
        value.trim(),
      )
      .filter(Boolean);
  const single =
    params.get(QUERY_KEY);

  if (multi.length > 0) {
    return [
      ...new Set(multi),
    ];
  }

  return single
    ? [single]
    : [];
}

export default function WorkspaceFileHandoff() {
  const pathname =
    usePathname();
  const loadedRef =
    useRef<string | null>(
      null,
    );

  useEffect(() => {
    if (
      DIRECT_WORKSPACE_ROUTES.some(
        (route) =>
          pathname === route ||
          pathname.startsWith(
            route + "/",
          ),
      )
    ) {
      return;
    }

    const workspaceFileIds =
      parseWorkspaceFileIds();
    const loadKey =
      pathname +
      ":" +
      workspaceFileIds.join(
        ",",
      );

    if (
      workspaceFileIds.length ===
        0 ||
      loadedRef.current ===
        loadKey
    ) {
      return;
    }

    loadedRef.current =
      loadKey;

    let cancelled = false;
    let attempts = 0;
    let timeoutId:
      | number
      | undefined;

    async function loadAndInject() {
      try {
        const loadedFiles =
          await Promise.all(
            workspaceFileIds.map(
              (id) =>
                getWorkspaceFile(
                  id,
                ),
            ),
          );

        if (cancelled) {
          return;
        }

        if (
          loadedFiles.some(
            (file) => !file,
          )
        ) {
          toast.error(
            workspaceFileIds.length >
              1
              ? "One or more browser workspace documents are no longer available."
              : "This browser workspace file is no longer available.",
          );
          return;
        }

        const files =
          loadedFiles.filter(
            (
              file,
            ): file is File =>
              Boolean(file),
          );

        const tryInject =
          () => {
            if (cancelled) {
              return;
            }

            const input =
              findFileInput();

            if (input) {
              injectFiles(
                input,
                files,
                workspaceFileIds,
              );

              if (
                workspaceFileIds.length ===
                1
              ) {
                void setActiveWorkspaceFile(
                  workspaceFileIds[0],
                ).catch(
                  (error) => {
                    console.warn(
                      "Kukureku could not update the current workspace version.",
                      error,
                    );
                  },
                );
              }

              toast(
                workspaceFileIds.length >
                  1
                  ? `Loaded ${files.length} browser workspace documents`
                  : "Loaded from browser workspace",
                workspaceFileIds.length >
                  1
                  ? {
                      description:
                        "Review the selected documents before running the operation.",
                    }
                  : {
                      description:
                        files[0]
                          ?.name,
                    },
              );
              return;
            }

            attempts += 1;

            if (
              attempts >= 20
            ) {
              toast.error(
                workspaceFileIds.length >
                  1
                  ? "This page could not accept the browser workspace documents automatically."
                  : "This page could not accept the browser workspace file automatically.",
              );
              return;
            }

            timeoutId =
              window.setTimeout(
                tryInject,
                50,
              );
          };

        window.requestAnimationFrame(
          tryInject,
        );
      } catch (error) {
        console.error(error);

        if (!cancelled) {
          toast.error(
            "Browser workspace storage is unavailable.",
          );
        }
      }
    }

    void loadAndInject();

    return () => {
      cancelled = true;

      if (
        timeoutId !==
        undefined
      ) {
        window.clearTimeout(
          timeoutId,
        );
      }
    };
  }, [pathname]);

  return null;
}
