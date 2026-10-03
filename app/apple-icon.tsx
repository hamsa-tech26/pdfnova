import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          borderRadius: "40px",
          background: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 58%, #06b6d4 100%)",
        }}
      >
        <div
          style={{
            width: 104,
            height: 104,
            borderRadius: 60,
            background: "white",
            position: "relative",
            display: "flex",
          }}
        >
          <div style={{ position: "absolute", left: 24, top: -18, width: 30, height: 34, borderRadius: 20, background: "#fb7185" }} />
          <div style={{ position: "absolute", left: 48, top: -24, width: 34, height: 38, borderRadius: 22, background: "#fb7185" }} />
          <div style={{ position: "absolute", left: 74, top: -16, width: 28, height: 32, borderRadius: 18, background: "#fb7185" }} />
          <div style={{ position: "absolute", right: -38, top: 40, width: 0, height: 0, borderTop: "18px solid transparent", borderBottom: "18px solid transparent", borderLeft: "40px solid #facc15" }} />
          <div style={{ position: "absolute", right: 24, top: 35, width: 12, height: 12, borderRadius: 12, background: "#0f172a" }} />
          <div style={{ position: "absolute", right: -4, top: 65, width: 20, height: 28, borderRadius: 16, background: "#fb7185" }} />
        </div>
      </div>
    ),
    size,
  );
}
