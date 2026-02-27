/**
 * Associations API
 *
 * GET: List all carrier associations for registration dropdown
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(request: NextRequest) {
  try {
    // Fetch all verified carrier associations
    const associations = await db.organization.findMany({
      where: {
        type: "CARRIER_ASSOCIATION",
        isVerified: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({
      associations,
    });
  } catch (error) {
    console.error("Error fetching associations:", error);
    return NextResponse.json(
      { error: "Failed to fetch associations" },
      { status: 500 }
    );
  }
}
