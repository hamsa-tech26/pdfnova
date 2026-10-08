"use client";

import type { LogicalTable } from "@/lib/pdf-engine-v4/model/logicalTable";
import { csvDownloadBlob } from "@/lib/converters/tableExport";
import { tableToCsvRows, inspectV4TableExport } from "@/lib/converters/v4TableExport";
import { saveAs } from "file-saver";
import { toast } from "sonner";

export default function EngineTableExport({tables}:{tables:LogicalTable[]}) {
  if (tables.length === 0) return null;
  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-xl font-extrabold text-gray-950 dark:text-white">Export extracted tables</h2>
      <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">
        Download editable CSV tables assembled by PDF Engine V4. Blank columns are preserved;
        spreadsheet formula-like cells are escaped. Extraction can be wrong: review the cells
        against the PDF before relying on the file. CSV cannot preserve page geometry or evidence.
        Use the complete V4 result JSON below for source details.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {tables.map((table,index) => (
          <div key={table.id || index} className="space-y-2">
          <button
            type="button"
            className="rounded-xl border border-cyan-700 bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-900 hover:bg-cyan-100 dark:bg-slate-950 dark:text-cyan-200"
            onClick={()=>{
              try {
                const rows=tableToCsvRows(table);
                saveAs(csvDownloadBlob(rows), "kukureku-v4-table-"+(index+1)+".csv");
              } catch(error) {
                toast.error(error instanceof Error ? error.message : "Could not export table as CSV.");
              }
            }}
          >
            Export table {index+1} CSV · {table.rows.length} rows
          </button>
          {inspectV4TableExport(table).needsReview && (
            <p role="status" className="max-w-xl rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
              Review required: {inspectV4TableExport(table).warnings.join(" ")} Source verification is necessary before relying on this CSV.
            </p>
          )}
          </div>
        ))}
      </div>
    </section>
  );
}
