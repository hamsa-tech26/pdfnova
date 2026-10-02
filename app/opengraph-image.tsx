import { ImageResponse } from "next/og";

export const alt = "Kukureku PDF - Free private browser-based PDF tools";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

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
          <div
            style={{
              width: 92,
              height: 92,
              borderRadius: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "linear-gradient(135deg, #22d3ee 0%, #2563eb 55%, #7c3aed 100%)",
              fontSize: 58,
              fontWeight: 900,
              position: "relative",
            }}
          >
            P
            <span
              style={{
                position: "absolute",
                right: 12,
                top: 8,
                fontSize: 23,
                color: "white",
              }}
            >
              <svg width="23" height="23" viewBox="0 0 24 24">
                <path d="M12 0 15 9 24 12 15 15 12 24 9 15 0 12 9 9Z" fill="white" />
              </svg>
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 42, fontWeight: 800 }}>Kukureku PDF</div>
            <div style={{ marginTop: 8, fontSize: 22, color: "#bae6fd" }}>
              Free private PDF & document tools
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
