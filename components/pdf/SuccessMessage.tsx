import { CheckCircle2 } from "lucide-react";

type SuccessMessageProps = {
  title: string;
  description: string;
};

export default function SuccessMessage({
  title,
  description,
}: SuccessMessageProps) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex items-start gap-3">
        <CheckCircle2
          size={24}
          className="mt-0.5 shrink-0 text-emerald-600"
        />

        <div>
          <h3 className="font-bold text-emerald-900">
            {title}
          </h3>

          <p className="mt-1 text-sm text-emerald-700">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}