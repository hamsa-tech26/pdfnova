import { FileText, Trash2 } from "lucide-react";

type FileListProps = {
  files: File[];
  onRemove: (index: number) => void;
};

export default function FileList({
  files,
  onRemove,
}: FileListProps) {
  if (files.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-lg font-bold text-gray-900">
        Selected files ({files.length})
      </h2>

      <div className="mt-4 space-y-3">
        {files.map((file, index) => (
          <div
            key={`${file.name}-${file.lastModified}-${index}`}
            className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 p-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <FileText size={20} />
              </div>

              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900">
                  {file.name}
                </p>

                <p className="text-sm text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onRemove(index)}
              className="ml-4 rounded-xl p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600"
              aria-label={`Remove ${file.name}`}
            >
              <Trash2 size={20} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}