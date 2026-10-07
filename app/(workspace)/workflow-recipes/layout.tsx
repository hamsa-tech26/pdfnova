import type {
  Metadata,
} from "next";
import type {
  ReactNode,
} from "react";

export const metadata: Metadata = {
  title: "Workflow Recipes",
  description:
    "Use deterministic, approval-based PDF workflow recipes with browser-local version continuity in Kukureku.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function WorkflowRecipesLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}
