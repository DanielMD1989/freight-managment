import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";
import { clearCSRFToken } from "@/lib/csrf";

export async function POST() {
  try {
    await clearSession();

    const response = NextResponse.json({
      message: "Logout successful",
    });

    // Clear CSRF token
    clearCSRFToken(response);

    return response;
  } catch (error) {
    console.error("Logout error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
