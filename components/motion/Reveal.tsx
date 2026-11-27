"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes } from "react";

type RevealProps = HTMLAttributes<HTMLDivElement> & {
  /** Optional entrance delay, clamped to keep content responsive. */
  delayMs?: number;
};

/**
 * Progressive-enhancement reveal.
 *
 * Content is visible in server-rendered HTML and remains visible when
 * JavaScript, IntersectionObserver, or motion preferences prevent animation.
 * Once revealed, the observer disconnects and the content stays visible.
 */
export default function Reveal({
  children,
  className = "",
  delayMs = 0,
  style,
  ...props
}: RevealProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [motionReady, setMotionReady] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    if (
      motionPreference.matches ||
      typeof IntersectionObserver === "undefined"
    ) {
      setMotionReady(false);
      setVisible(true);
      return;
    }

    setMotionReady(true);
    setVisible(false);

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;

        setVisible(true);
        observer.unobserve(entry.target);
        observer.disconnect();
      },
      {
        root: null,
        rootMargin: "0px 0px -48px 0px",
        threshold: 0.08,
      },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const delay = Math.max(0, Math.min(240, Math.round(delayMs)));
  const revealStyle = {
    ...style,
    "--motion-delay": `${delay}ms`,
  } as CSSProperties;

  return (
    <div
      {...props}
      ref={elementRef}
      className={`motion-reveal ${className}`.trim()}
      data-motion-ready={motionReady ? "true" : "false"}
      data-motion-visible={visible ? "true" : "false"}
      style={revealStyle}
    >
      {children}
    </div>
  );
}
