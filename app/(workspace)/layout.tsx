import WorkspaceSidebar from "@/components/WorkspaceSidebar";
import type { ReactNode } from "react";

type WorkspaceLayoutProps = {
  children: ReactNode;
};

export default function WorkspaceLayout({
  children,
}: WorkspaceLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <WorkspaceSidebar />

      <div className="min-w-0 flex-1">
        {children}
      </div>
    </div>
  );
}