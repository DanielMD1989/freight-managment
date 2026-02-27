import { ImageResponse } from "next/og";

// Icon metadata
export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

// Generate icon
export default function Icon() {
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
        borderRadius: "6px",
        padding: "4px",
      }}
    >
      {}
      <img
        src={`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/truck-icon.png`}
        alt="Freight"
        width="24"
        height="24"
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
