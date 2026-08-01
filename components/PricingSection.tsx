import { Check, Sparkles } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "₹0",
    description: "For occasional PDF tasks.",
    features: [
      "10 tasks per day",
      "Files up to 25 MB",
      "Basic PDF tools",
      "Standard processing",
      "Advertisements",
    ],
    buttonText: "Start Free",
    featured: false,
  },
  {
    name: "Pro",
    price: "₹299",
    description: "For individuals who work with PDFs regularly.",
    features: [
      "Unlimited PDF tasks",
      "Files up to 500 MB",
      "AI PDF tools",
      "OCR and advanced tools",
      "Faster processing",
      "No advertisements",
    ],
    buttonText: "Choose Pro",
    featured: true,
  },
  {
    name: "Business",
    price: "₹899",
    description: "For teams and growing organizations.",
    features: [
      "Everything in Pro",
      "Up to 10 team members",
      "Shared workspace",
      "Priority support",
      "Centralized billing",
      "Usage analytics",
    ],
    buttonText: "Choose Business",
    featured: false,
  },
];

export default function PricingSection() {
  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">
            Pricing
          </p>

          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-gray-900 md:text-5xl">
            Simple plans for every kind of work
          </h2>

          <p className="mt-5 text-lg leading-8 text-gray-600">
            Start free and upgrade when you need more power, larger files, and
            advanced AI tools.
          </p>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-3xl border p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl ${
                plan.featured
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-200 bg-white text-gray-900"
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950">
                  <Sparkles size={16} />
                  Most Popular
                </div>
              )}

              <h3 className="text-2xl font-extrabold">{plan.name}</h3>

              <p
                className={`mt-3 text-sm leading-6 ${
                  plan.featured ? "text-blue-100" : "text-gray-600"
                }`}
              >
                {plan.description}
              </p>

              <div className="mt-8 flex items-end gap-2">
                <span className="text-5xl font-extrabold">{plan.price}</span>
                <span
                  className={`pb-1 text-sm ${
                    plan.featured ? "text-blue-100" : "text-gray-500"
                  }`}
                >
                  /month
                </span>
              </div>

              <button
                className={`mt-8 w-full rounded-xl px-6 py-3 font-semibold transition ${
                  plan.featured
                    ? "bg-white text-blue-700 hover:bg-blue-50"
                    : "bg-gray-900 text-white hover:bg-gray-800"
                }`}
              >
                {plan.buttonText}
              </button>

              <ul className="mt-8 space-y-4">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <Check
                      size={18}
                      className={
                        plan.featured ? "text-cyan-300" : "text-emerald-600"
                      }
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}