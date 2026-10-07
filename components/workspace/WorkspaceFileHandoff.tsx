"use client";

import {
  getWorkspaceFile,
} from "@/lib/storage/workspaceFiles";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const QUERY_KEY = "workspaceFile";

function findFileInput() {
  return document.querySelector(
    'input[type="file"]:not([disabled])',
  ) as HTMLInputElement | null;
}

function injectFile(
  input: HTMLInputElement,
  file: File,
) {
  const transfer =
    new DataTransfer();

  transfer.items.add(file);
  input.files = transfer.files;

  input.dispatchEvent(
    new Event("change", {
      bubbles: true,
    }),
  );
}

export default function WorkspaceFileHandoff() {
  const loadedRef =
    useRef<string | null>(null);

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search,
      );
    const workspaceFileId =
      params.get(QUERY_KEY);

    if (
      !workspaceFileId ||
      loadedRef.current ===
        workspaceFileId
    ) {
      return;
    }

    loadedRef.current =
      workspaceFileId;

    let cancelled = false;
    let attempts = 0;
    let timeoutId:
      | number
      | undefined;

    async function loadAndInject() {
      try {
        const file =
          await getWorkspaceFile(
            workspaceFileId!,
          );

        if (cancelled) {
          return;
        }

        if (!file) {
          toast.error(
            "This browser workspace file is no longer available.",
          );
          return;
        }

        const tryInject = () => {
          if (cancelled) {
            return;
          }

          const input =
            findFileInput();

          if (input) {
            injectFile(
              input,
              file,
            );

            toast(
              "Loaded from browser workspace",
              {
                description:
                  file.name,
              },
            );
            return;
          }

          attempts += 1;

          if (attempts >= 20) {
            toast.error(
              "This page could not accept the browser workspace file automatically.",
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
        timeoutId !== undefined
      ) {
        window.clearTimeout(
          timeoutId,
        );
      }
    };
  }, []);

  return null;
}
