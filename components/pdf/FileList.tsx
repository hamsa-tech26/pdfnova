import {
  ArrowDown,
  ArrowUp,
  FileText,
  Trash2,
} from "lucide-react";

type FileListProps = {
  files: File[];
  onRemove: (index: number) => void;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
};

export default function FileList({
  files,
  onRemove,
  onMoveUp,
  onMoveDown,
}: FileListProps) {
  if (files.length === 0) {
    return null;
  }

  const canReorder = Boolean(onMoveUp && onMoveDown);

  return (
    <div className="mt-8">
      <div>
        <h2 className="text-lg font-bold text-gray-900">
          Selected files ({files.length})
        </h2>

        {canReorder && (
          <p className="mt-1 text-sm text-gray-500">
            Arrange the files in the order in which they should be merged.
          </p>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {files.map((file, index) => (
          <div
            key={`${file.name}-${file.lastModified}-${index}`}
            className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <FileText size={21} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="break-words font-semibold text-gray-900">
                  {index + 1}. {file.name}
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-200 pt-4">
              {canReorder && (
                <>
                  <button
                    type="button"
                    onClick={() => onMoveUp?.(index)}
                    disabled={index === 0}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowUp size={17} />
                    Move Up
                  </button>

                  <button
                    type="button"
                    onClick={() => onMoveDown?.(index)}
                    disabled={index === files.length - 1}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowDown size={17} />
                    Move Down
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => onRemove(index)}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
              >
                <Trash2 size={17} />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}