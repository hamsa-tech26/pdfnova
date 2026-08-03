type OrganizeToolbarProps = {
  totalPages: number;
  selectedPages: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onSavePdf: () => void;
  isSaving: boolean;
};

export default function OrganizeToolbar({
  totalPages,
  selectedPages,
  onSelectAll,
  onClearSelection,
  onDeleteSelected,
  onSavePdf,
  isSaving,
}: OrganizeToolbarProps) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            PDF Pages ({totalPages})
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Selected Pages: {selectedPages}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={onSelectAll}
            className="rounded-xl border border-gray-300 px-4 py-2 font-semibold transition hover:border-blue-400 hover:bg-blue-50"
          >
            Select All
          </button>

          <button
            onClick={onClearSelection}
            className="rounded-xl border border-gray-300 px-4 py-2 font-semibold transition hover:border-blue-400 hover:bg-blue-50"
          >
            Clear
          </button>

          <button
            onClick={onDeleteSelected}
            disabled={selectedPages === 0}
            className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete Selected
          </button>

          <button
            onClick={onSavePdf}
            disabled={isSaving}
            className="rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}