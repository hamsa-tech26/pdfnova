import {
  CheckCircle2,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Presentation,
  Trash2,
} from "lucide-react";

type FileCardProps = {
  file: File;
  onRemove?: () => void;
  removeLabel?: string;
  statusText?: string;
  progress?: number;
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

function formatModifiedDate(timestamp: number) {
  if (!timestamp) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function getFileDetails(file: File) {
  const fileName = file.name.toLowerCase();

  if (
    file.type === "application/pdf" ||
    fileName.endsWith(".pdf")
  ) {
    return {
      label: "PDF Document",
      icon: FileText,
      accent: "bg-red-50 text-red-600",
    };
  }

  if (
    file.type.startsWith("image/") ||
    /\.(jpg|jpeg|png|webp)$/i.test(fileName)
  ) {
    return {
      label: "Image File",
      icon: FileImage,
      accent: "bg-violet-50 text-violet-600",
    };
  }

  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.endsWith(".docx")
  ) {
    return {
      label: "Word Document",
      icon: FileText,
      accent: "bg-blue-50 text-blue-600",
    };
  }

  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    /\.(xlsx|xls)$/i.test(fileName)
  ) {
    return {
      label: "Excel Spreadsheet",
      icon: FileSpreadsheet,
      accent: "bg-emerald-50 text-emerald-600",
    };
  }

  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    /\.(pptx|ppt)$/i.test(fileName)
  ) {
    return {
      label: "PowerPoint Presentation",
      icon: Presentation,
      accent: "bg-orange-50 text-orange-600",
    };
  }

  if (
    file.type.includes("zip") ||
    /\.(zip|rar|7z)$/i.test(fileName)
  ) {
    return {
      label: "Archive File",
      icon: FileArchive,
      accent: "bg-amber-50 text-amber-600",
    };
  }

  return {
    label: "Document",
    icon: FileText,
    accent: "bg-gray-100 text-gray-600",
  };
}

export default function FileCard({
  file,
  onRemove,
  removeLabel = "Remove file",
  statusText = "Ready for processing",
  progress,
}: FileCardProps) {
  const details = getFileDetails(file);
  const Icon = details.icon;

  const showProgress =
    typeof progress === "number" &&
    Number.isFinite(progress);

  const safeProgress = showProgress
    ? Math.min(100, Math.max(0, progress))
    : 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${details.accent}`}
          >
            <Icon size={23} />
          </div>

          <div className="min-w-0">
            <p className="break-all font-semibold text-gray-900">
              {file.name}
            </p>

            <p className="mt-1 text-sm font-medium text-gray-500">
              {details.label}
            </p>
          </div>
        </div>

        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={removeLabel}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 sm:w-auto"
          >
            <Trash2 size={17} />
            Remove
          </button>
        )}
      </div>

      <div className="mt-5 grid gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2">
        <div>
          <p className="text-sm text-gray-500">
            File size
          </p>

          <p className="mt-1 font-semibold text-gray-900">
            {formatFileSize(file.size)}
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-500">
            Last modified
          </p>

          <p className="mt-1 font-semibold text-gray-900">
            {formatModifiedDate(file.lastModified)}
          </p>
        </div>
      </div>

      {showProgress && (
        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-gray-700">
              Processing progress
            </p>

            <p className="text-sm font-bold text-blue-600">
              {Math.round(safeProgress)}%
            </p>
          </div>

          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-300"
              style={{
                width: `${safeProgress}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
        <CheckCircle2 size={18} className="shrink-0" />
        {statusText}
      </div>
    </div>
  );
}