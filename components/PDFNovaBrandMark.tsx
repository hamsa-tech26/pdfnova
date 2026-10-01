import Image from "next/image";

type PDFNovaBrandMarkProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

export default function PDFNovaBrandMark({
  size = 40,
  className = "",
  priority = false,
}: PDFNovaBrandMarkProps) {
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