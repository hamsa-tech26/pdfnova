import {
  Bot,
  Languages,
  MessageSquareText,
  Search,
  Sparkles,
  WandSparkles,
} from "lucide-react";

const aiTools = [
  {
    title: "Chat with PDF",
    description: "Ask questions and get clear answers from your document.",
    icon: MessageSquareText,
  },
  {
    title: "Summarize",
    description: "Turn long documents into short, useful summaries.",
    icon: Sparkles,
  },
  {
    title: "Translate",
    description: "Understand your PDF in another language instantly.",
    icon: Languages,
  },
  {
    title: "Explain",
    description: "Make difficult paragraphs easier to understand.",
    icon: Bot,
  },
  {
    title: "Find Information",
    description: "Locate important names, dates, figures, and sections.",
    icon: Search,
  },
  {
    title: "Rewrite",
    description: "Improve tone, clarity, and grammar with AI assistance.",
    icon: WandSparkles,
  },
];

export default function AISection() {
  return (
    <section id="ai" className="bg-slate-950 px-6 py-24 text-white">
      <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Kukureku AI - Coming Soon
          </p>

          <h2 className="mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">
            Understand your documents, not just convert them
          </h2>

          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
            Kukureku AI is planned to help you summarize, translate, explain, rewrite, and find important information inside your PDFs. These AI features are not part of the current launch.
          </p>

          <div className="mt-8 inline-flex rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-6 py-3 font-semibold text-cyan-200">
            Coming Soon
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950">
              <Bot size={26} />
            </div>

            <div>
              <h3 className="text-xl font-bold">Kukureku AI Assistant</h3>
              <p className="text-sm text-slate-400">
                Planned AI document assistance
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {aiTools.map((tool) => {
              const Icon = tool.icon;

              return (
                <div
                  key={tool.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:-translate-y-1 hover:bg-white/10"
                >
                  <Icon size={24} className="text-cyan-300" />

                  <h4 className="mt-4 font-bold">{tool.title}</h4>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {tool.description}
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