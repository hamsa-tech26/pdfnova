import Image from "next/image";

type PeakateeBrandMarkProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

export default function PeakateeBrandMark({
  size = 40,
  className = "",
  priority = false,
}: PeakateeBrandMarkProps) {
  return (
    <Image
      src="/icons/pdfnova-brand-v1-192.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      priority={priority}
      className={`shrink-0 ${className}`}
    />
  );
}