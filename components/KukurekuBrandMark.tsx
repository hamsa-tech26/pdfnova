import Image from "next/image";

type KukurekuBrandMarkProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

export default function KukurekuBrandMark({
  size = 40,
  className = "",
  priority = false,
}: KukurekuBrandMarkProps) {
  return (
    <Image
      src="/icons/kukureku-brand-v1-192.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      priority={priority}
      className={`shrink-0 ${className}`}
    />
  );
}
