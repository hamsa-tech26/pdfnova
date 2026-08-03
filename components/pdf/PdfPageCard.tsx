import { Check, Download, FileImage } from "lucide-react";

type PdfPageCardProps = {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDownload: () => void;
};

export default function PdfPageCard({
  pageNumber,
  dataUrl,
  width,
  height,
  isSelected,
  onToggleSelect,
  onDownload,
}: PdfPageCardProps) {
  return (
    <article
      className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl ${
        isSelected
          ? "border-blue-500 ring-4 ring-blue-100"
          : "border-gray-200"
      }`}
    >
      <div className="relative bg-gray-100 p-4">
        <img
          src={dataUrl}
          alt={`PDF page ${pageNumber}`}
          className="mx-auto max-h-[360px] w-auto rounded-xl border border-gray-200 bg-white object-contain shadow-sm"
        />

        <button
          type="button"
          onClick={onToggleSelect}
          className={`absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition ${
            isSelected
              ? "border-blue-600 bg-blue-600 text-white"
              : "border-gray-300 bg-white text-gray-500 hover:border-blue-400 hover:text-blue-600"
          }`}
          aria-label={
            isSelected
              ? `Deselect page ${pageNumber}`
              : `Select page ${pageNumber}`
          }
        >
          {isSelected ? <Check size={18} /> : null}
        </button>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-gray-900">
              <FileImage size={19} className="text-blue-600" />

              <h3 className="font-bold">Page {pageNumber}</h3>
            </div>

            <p className="mt-2 text-sm text-gray-500">
              {width} × {height} px
            </p>
          </div>

          {isSelected && (
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
              Selected
            </span>
          )}
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onToggleSelect}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              isSelected
                ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                : "border border-gray-300 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50"
            }`}
          >
            {isSelected ? "Deselect" : "Select"}
          </button>

          <button
            type="button"
            onClick={onDownload}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600"
          >
            <Download size={17} />
            Download JPG
          </button>
        </div>
      </div>
    </article>
  );
}