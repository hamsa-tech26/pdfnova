const features = [
  {
    title: "Fast Processing",
    description: "Complete everyday PDF tasks quickly with a smooth workflow.",
    icon: "⚡",
  },
  {
    title: "Secure by Design",
    description: "Your files are handled carefully and prepared for secure processing.",
    icon: "🔒",
  },
  {
    title: "AI Powered",
    description: "Summarize, explain, translate, and understand documents faster.",
    icon: "✨",
  },
  {
    title: "Works Everywhere",
    description: "Use PDFNova on desktop, tablet, or mobile without installation.",
    icon: "🌐",
  },
];

export default function FeaturesSection() {
  return (
    <section className="bg-slate-50 px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">
            Why PDFNova
          </p>

          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-gray-900 md:text-5xl">
            Simple, secure, and built for modern document work
          </h2>

          <p className="mt-5 text-lg leading-8 text-gray-600">
            Everything is designed to help you finish document tasks with less
            effort and greater confidence.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-2xl">
                {feature.icon}
              </div>

              <h3 className="mt-6 text-xl font-bold text-gray-900">
                {feature.title}
              </h3>

              <p className="mt-3 text-sm leading-6 text-gray-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}