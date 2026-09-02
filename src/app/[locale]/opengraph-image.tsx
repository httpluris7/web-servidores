import { ImageResponse } from "next/og";
import { site } from "@/data/site";

// OG image generada como PNG 1200×630 (el convention de Next añade el og:image).
// Sustituye al antiguo /og.svg, que varias plataformas y LLMs no renderizan.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";
export const alt = site.brand;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#05070d",
          color: "#f4f6f8",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div style={{ width: "26px", height: "26px", borderRadius: "9999px", background: "#00e5a0" }} />
          <div style={{ fontSize: "38px", fontWeight: 700 }}>{site.brand}</div>
        </div>
        <div style={{ display: "flex", marginTop: "34px", fontSize: "62px", fontWeight: 800, lineHeight: 1.1, maxWidth: "960px" }}>
          VPS, hosting cPanel y dominios en Europa
        </div>
        <div style={{ display: "flex", marginTop: "28px", fontSize: "28px", color: "#9aa7b2" }}>
          NVMe · 10 Gbps · protección DDoS incluida · aprovisionamiento en 60 s
        </div>
        <div style={{ display: "flex", marginTop: "auto", fontSize: "24px", color: "#00e5a0", fontFamily: "monospace" }}>
          {site.domain}
        </div>
      </div>
    ),
    { ...size },
  );
}
