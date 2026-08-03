import type { ReactNode } from "react";

type ToolContainerProps = {
  children: ReactNode;
};

export default function ToolContainer({
  children,
}: ToolContainerProps) {
  return (
    <section className="mt-12 rounded-3xl border border-blue-100 bg-white p-6 shadow-xl md:p-10">
      {children}
    </section>
  );
}