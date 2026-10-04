import Link from "next/link";
import {
  CheckCircle2,
  Monitor,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

const features = [
  {
    title: "Private by design",
    description:
      "Supported tools process documents locally in your browser so your files stay on your device.",
    icon: ShieldCheck,
  },
  {
    title: "No installation",
    description:
      "Open Kukureku PDF in your browser and start working without installing desktop software.",
    icon: Monitor,
  },
  {
    title: "Focused workflows",
    description:
      "Each tool is designed around one clear task with simple controls and direct downloads.",
    icon: CheckCircle2,
  },
  {
    title: "Works across devices",
    description:
      "Use Kukureku PDF on desktop, tablet, or mobile with responsive layouts built for everyday work.",
    icon: Smartphone,
  },
];

export default function FeaturesSection() {
  return (
    <section
      id="about"
      className="border-y border-gray-200 bg-slate-50 px-5 py-20 sm:px-6 lg:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">
              Why Kukureku PDF
            </p>

            <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-gray-950 md:text-5xl">
              Built for simple, private document work
            </h2>

            <p className="mt-5 max-w-xl text-lg leading-8 text-gray-600">
              Kukureku takes its name from the rooster&apos;s call at dawn — a signal to start.
              Our PDF workspace follows the same idea: open a document, get the job done,
              and move on with fast, private browser-based tools.
            </p>

            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3">
              <Link
                href="/guides/private-pdf-tools"
                className="inline-flex font-semibold text-blue-600 transition hover:text-blue-700"
              >
                Learn how private browser-based PDF processing works →
              </Link>

              <Link
                href="/trust"
                className="inline-flex font-semibold text-gray-700 transition hover:text-blue-700"
              >
                View the Trust Center →
              </Link>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <Icon size={23} />
                  </div>

                  <h3 className="mt-5 text-xl font-bold text-gray-950">
                    {feature.title}
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-gray-600">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
