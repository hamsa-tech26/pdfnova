import { FileText, Trash2 } from "lucide-react";

type FileCardProps = {
  file: File;
  onRemove?: () => void;
  removeLabel?: string;
};

function formatFileSize(sizeInBytes: number) {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  }

  if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeInBytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function FileCard({
  file,
  onRemove,
  removeLabel = "Remove file",
}: FileCardProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
          <FileText size={21} />
        </div>

        <div className="min-w-0">
          <p className="break-words font-semibold text-gray-900">
            {file.name}
          </p>

          <p className="mt-1 text-sm text-gray-500">
            {formatFileSize(file.size)}
          </p>
        </div>
      </div>

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
        >
          <Trash2 size={17} />
          Remove
        </button>
      )}
    </div>
  );
}