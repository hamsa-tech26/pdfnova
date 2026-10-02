import { ImageResponse } from "next/og";

export const alt = "Kukureku PDF - Free private browser-based PDF tools";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

function KukurekuMark() {
  return (
    <svg width="92" height="92" viewBox="0 0 1024 1024">
      <defs>
        <linearGradient id="og-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0f172a" />
          <stop offset="0.55" stopColor="#1d4ed8" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="220" fill="url(#og-bg)" />
      <circle cx="512" cy="522" r="290" fill="#fff" opacity="0.07" />
      <path
        d="M300 835C360 775 392 702 380 620C363 505 399 390 495 338C575 295 682 318 731 397C770 460 757 548 704 600C659 644 610 660 584 716C559 771 571 824 622 875H300Z"
        fill="#fff"
      />
      <path d="M711 438L840 500L711 558Z" fill="#facc15" />
      <circle cx="505" cy="304" r="64" fill="#fb7185" />
      <circle cx="578" cy="278" r="72" fill="#fb7185" />
      <circle cx="654" cy="316" r="60" fill="#fb7185" />
      <ellipse cx="680" cy="590" rx="45" ry="64" fill="#fb7185" />
      <circle cx="641" cy="431" r="27" fill="#0f172a" />
      <circle cx="650" cy="422" r="7" fill="#fff" />
      <path d="M300 745L474 674L585 875H300Z" fill="#164e9d" />
      <path
        d="M196 244L250 304M161 352L238 375"
        stroke="#fde68a"
        strokeWidth="24"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "linear-gradient(135deg, #020617 0%, #0f1f4d 48%, #0c4a6e 100%)",
          color: "white",
          padding: "68px 76px",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <KukurekuMark />

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 42, fontWeight: 800 }}>Kukureku PDF</div>
            <div style={{ marginTop: 8, fontSize: 22, color: "#bae6fd" }}>
              Free private PDF &amp; document tools
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 66, fontWeight: 800, letterSpacing: -2 }}>
            Essential PDF tools.
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 50,
              fontWeight: 750,
              color: "#dbeafe",
            }}
          >
            Fast. Private. Simple.
          </div>
          <div style={{ marginTop: 30, fontSize: 24, color: "#bfdbfe" }}>
            Merge • Split • Compress • Convert • Organize • Watermark • Unlock
          </div>
        </div>

        <div style={{ display: "flex", gap: 36, fontSize: 18, color: "#a5f3fc" }}>
          <span>10 working tools</span>
          <span>Browser-based processing</span>
          <span>No installation</span>
        </div>
      </div>
    ),
    size,
  );
}
