import { FileText, Globe2, ShieldCheck, Users } from "lucide-react";

const stats = [
  {
    value: "10M+",
    label: "PDFs Processed",
    icon: FileText,
  },
  {
    value: "500K+",
    label: "Happy Users",
    icon: Users,
  },
  {
    value: "150+",
    label: "Countries Reached",
    icon: Globe2,
  },
  {
    value: "99.9%",
    label: "Reliable Uptime",
    icon: ShieldCheck,
  },
];

export default function StatsSection() {
  return (
    <section className="border-y border-gray-200 bg-slate-50 px-6 py-16">
      <div className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="rounded-3xl border border-gray-200 bg-white p-6 text-center shadow-sm"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Icon size={24} />
              </div>

              <p className="mt-5 text-4xl font-extrabold text-gray-900">
                {stat.value}
              </p>

              <p className="mt-2 text-sm font-medium text-gray-600">
                {stat.label}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}