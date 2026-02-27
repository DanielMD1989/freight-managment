import { ImageResponse } from "next/og";

// Apple touch icon metadata
export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

// Generate Apple touch icon
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        background:
          "linear-gradient(135deg, #0d9488 0%, #14b8a6 50%, #2dd4bf 100%)",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "32px",
        padding: "24px",
      }}
    >
      {}
      <img
        src={`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/truck-icon.png`}
        alt="Freight"
        width="132"
        height="132"
        style={{
          objectFit: "contain",
        }}
      />
    </div>,
    {
      ...size,
    }
  );
}
