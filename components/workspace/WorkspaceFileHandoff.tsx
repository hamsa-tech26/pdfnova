"use client";

import {
  getWorkspaceFile,
  setActiveWorkspaceFile,
} from "@/lib/storage/workspaceFiles";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const QUERY_KEY = "workspaceFile";

const DIRECT_WORKSPACE_ROUTES = [
  "/workflow-recipes",
];

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
  const pathname = usePathname();
  const loadedRef =
    useRef<string | null>(null);

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

    const params =
      new URLSearchParams(
        window.location.search,
      );
    const workspaceFileId =
      params.get(QUERY_KEY);

    const loadKey =
      pathname +
      ":" +
      (workspaceFileId ?? "");

    if (
      !workspaceFileId ||
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

            void setActiveWorkspaceFile(
              workspaceFileId!,
            ).catch((error) => {
              console.warn(
                "Kukureku could not update the current workspace version.",
                error,
              );
            });

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
  }, [pathname]);

  return null;
}
