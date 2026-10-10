import type { Metadata } from "next";
import type { ReactNode } from "react";
export const metadata: Metadata = {
  title: "Private PDF Workflow Planner",
  description: "A deterministic, review-first planner that links to local PDF tools without making automatic edits.",
  robots: { index: false, follow: false },
};
export default function WorkflowPlannerLayout({ children }: Readonly<{ children: ReactNode }>) { return children; }
