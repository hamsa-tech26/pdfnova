import {
  Archive,
  FileImage,
  FileText,
  Gauge,
  LayoutDashboard,
  MessageSquareText,
  Scissors,
} from "lucide-react";

const workspaceLinks = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Merge PDF",
    href: "/merge-pdf",
    icon: FileText,
  },
  {
    label: "Split PDF",
    href: "/split-pdf",
    icon: Scissors,
  },
  {
    label: "Compress PDF",
    href: "#",
    icon: Archive,
  },
  {
    label: "JPG to PDF",
    href: "#",
    icon: FileImage,
  },
  {
    label: "PDF to Word",
    href: "#",
    icon: FileText,
  },
  {
    label: "Nova AI",
    href: "#",
    icon: MessageSquareText,
  },
];

export default function WorkspaceSidebar() {
  return (
    <aside className="hidden min-h-screen w-72 border-r border-gray-200 bg-white px-5 py-6 lg:block">
      <div className="flex items-center gap-3 px-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 text-white shadow-lg shadow-blue-200">
          <Gauge size={23} />
        </div>

        <div>
          <p className="text-lg font-extrabold text-gray-950">PDFNova</p>
          <p className="text-xs font-medium text-gray-500">Workspace</p>
        </div>
      </div>

      <nav className="mt-10 space-y-2">
        {workspaceLinks.map((link) => {
          const Icon = link.icon;

          return (
            <a
              key={link.label}
              href={link.href}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-blue-50 hover:text-blue-700"
            >
              <Icon size={19} />
              {link.label}
            </a>
          );
        })}
      </nav>

      <div className="mt-10 rounded-3xl bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white">
        <p className="text-sm font-semibold text-cyan-300">PDFNova Pro</p>

        <p className="mt-3 text-sm leading-6 text-slate-300">
          Unlock larger files, advanced tools, and Nova AI.
        </p>

        <button className="mt-5 w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100">
          Upgrade
        </button>
      </div>
    </aside>
  );
}