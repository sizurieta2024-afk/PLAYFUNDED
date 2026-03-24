import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "PlayFunded — La plataforma de trading deportivo para América Latina";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0A0A0A",
        position: "relative",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 900,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(201,168,76,0.18) 0%, transparent 70%)",
        }}
      />
      {/* Pink glow bottom-left */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: 400,
          height: 300,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(255,45,120,0.08) 0%, transparent 70%)",
        }}
      />

      {/* Gold rule */}
      <div
        style={{
          width: 64,
          height: 2,
          backgroundColor: "#C9A84C",
          marginBottom: 28,
        }}
      />

      {/* Brand */}
      <div
        style={{
          fontSize: 84,
          fontWeight: 900,
          color: "#C9A84C",
          letterSpacing: "-3px",
          marginBottom: 12,
          fontFamily: "Georgia, serif",
        }}
      >
        PlayFunded
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: 26,
          color: "#94A3B8",
          fontStyle: "italic",
          marginBottom: 44,
          fontFamily: "Georgia, serif",
        }}
      >
        Nuestro riesgo, tus ganancias
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: 20,
          color: "#64748B",
          textAlign: "center",
          maxWidth: 680,
          lineHeight: 1.5,
          fontFamily: "Arial, sans-serif",
        }}
      >
        La plataforma de trading deportivo para América Latina
      </div>

      {/* Domain pill */}
      <div
        style={{
          display: "flex",
          marginTop: 44,
          padding: "10px 26px",
          borderRadius: 8,
          border: "1px solid rgba(201,168,76,0.35)",
          color: "#C9A84C",
          fontSize: 18,
          letterSpacing: "0.1em",
          fontFamily: "monospace",
        }}
      >
        playfunded.lat
      </div>
    </div>,
    { ...size },
  );
}
