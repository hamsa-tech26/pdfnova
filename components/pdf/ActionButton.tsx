import { Download, LoaderCircle } from "lucide-react";

type ActionButtonProps = {
  isLoading: boolean;
  loadingText: string;
  buttonText: string;
  onClick: () => void;
  disabled?: boolean;
};

export default function ActionButton({
  isLoading,
  loadingText,
  buttonText,
  onClick,
  disabled = false,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-6 py-4 font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isLoading ? (
        <>
          <LoaderCircle size={20} className="animate-spin" />
          {loadingText}
        </>
      ) : (
        <>
          <Download size={20} />
          {buttonText}
        </>
      )}
    </button>
  );
}