import {
  ArrowDown,
  ArrowUp,
  Check,
  RotateCw,
  Trash2,
} from "lucide-react";

type OrganizePageCardProps = {
  pageNumber: number;
  dataUrl: string;
  rotation: number;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggleSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRotate: () => void;
  onDelete: () => void;
};

export default function OrganizePageCard({
  pageNumber,
  dataUrl,
  rotation,
  isSelected,
  isFirst,
  isLast,
  onToggleSelect,
  onMoveUp,
  onMoveDown,
  onRotate,
  onDelete,
}: OrganizePageCardProps) {
  return (
    <article
      className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl ${
        isSelected
          ? "border-blue-500 ring-4 ring-blue-100"
          : "border-gray-200"
      }`}
    >
      <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden bg-gray-100 p-4">
        <img
          src={dataUrl}
          alt={`PDF page ${pageNumber}`}
          className="max-h-[300px] max-w-full rounded-xl border border-gray-200 bg-white object-contain shadow-sm transition-transform duration-300"
          style={{
            transform: `rotate(${rotation}deg)`,
          }}
        />

        <button
          type="button"
          onClick={onToggleSelect}
          className={`absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border shadow-sm transition ${
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
          {isSelected ? <Check size={19} /> : null}
        </button>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-bold text-gray-900">
              Page {pageNumber}
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Rotation: {rotation}°
            </p>
          </div>

          {isSelected && (
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
              Selected
            </span>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUp size={17} />
            Move Up
          </button>

          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowDown size={17} />
            Move Down
          </button>

          <button
            type="button"
            onClick={onRotate}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
          >
            <RotateCw size={17} />
            Rotate
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            <Trash2 size={17} />
            Delete
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleSelect}
          className={`mt-2 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            isSelected
              ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
              : "border border-gray-300 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50"
          }`}
        >
          {isSelected ? "Deselect Page" : "Select Page"}
        </button>
      </div>
    </article>
  );
}