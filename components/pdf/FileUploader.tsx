import { FilePlus2, Upload } from "lucide-react";
import { ChangeEvent, RefObject } from "react";

type FileUploaderProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileSelection: (event: ChangeEvent<HTMLInputElement>) => void;
  accept?: string;
  multiple?: boolean;
  title: string;
  description: string;
  buttonText: string;
  helperText: string;
};

export default function FileUploader({
  fileInputRef,
  onFileSelection,
  accept = "application/pdf",
  multiple = true,
  title,
  description,
  buttonText,
  helperText,
}: FileUploaderProps) {
  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={onFileSelection}
      />

      <div className="rounded-3xl border-2 border-dashed border-blue-300 bg-blue-50 px-6 py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white">
          <Upload size={30} />
        </div>

        <h2 className="mt-6 text-2xl font-bold text-gray-900">{title}</h2>

        <p className="mt-3 text-gray-600">{description}</p>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-7 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
        >
          <FilePlus2 size={20} />
          {buttonText}
        </button>

        <p className="mt-4 text-sm text-gray-500">{helperText}</p>
      </div>
    </>
  );
}