import type { Metadata } from "next";
import MotionShowcase from "@/components/motion/MotionShowcase";

export const metadata: Metadata = {
  title: "Motion Lab — Kukureku PDF",
  description: "An isolated visual prototype of Kukureku's premium motion and interaction system.",
  robots: { index: false, follow: false },
};

export default function MotionLabPage() {
  return <MotionShowcase />;
}
