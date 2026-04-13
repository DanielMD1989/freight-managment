export const dynamic = "force-dynamic";
/**
 * CDL Photo Upload — POST /api/drivers/[id]/cdl-upload
 *
 * Multipart form upload for CDL front/back photos and medical certificate.
 * Files stored via lib/fileStorage.ts; URLs saved to DriverProfile fields.
 * Separate from /api/documents (which remains blocked for DRIVER role).
 *
 * Auth: carrier-in-same-org OR the driver themselves (same as PUT /api/drivers/[id]).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { handleApiError } from "@/lib/apiErrors";
import { validateUploadedFile, saveFile } from "@/lib/fileStorage";
import { checkRateLimit, RATE_LIMIT_DOCUMENT_UPLOAD } from "@/lib/rateLimit";

/** Map from form field name → DriverProfile column */
const FIELD_MAP: Record<string, string> = {
  cdlFront: "cdlFrontUrl",
  cdlBack: "cdlBackUrl",
  medicalCert: "medicalCertUrl",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireActiveUser();
    const { id } = await params;

    // --- Authorization: same pattern as PUT /api/drivers/[id] ---
    const driver = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        organizationId: true,
        driverProfile: { select: { id: true } },
      },
    });

    if (!driver || driver.role !== "DRIVER" || !driver.organizationId) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    const callerIsCarrierSameOrg =
      session.role === "CARRIER" &&
      !!session.organizationId &&
      driver.organizationId === session.organizationId;
    const callerIsSelf =
      session.role === "DRIVER" && session.userId === driver.id;

    if (!callerIsCarrierSameOrg && !callerIsSelf) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    if (!driver.driverProfile) {
      return NextResponse.json(
        { error: "Driver profile not found" },
        { status: 400 }
      );
    }

    // --- Rate limit: 10 uploads per hour per driver ---
    const rateLimitResult = await checkRateLimit(
      RATE_LIMIT_DOCUMENT_UPLOAD,
      `cdl:${id}`
    );
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: "CDL upload limit exceeded. Maximum 10 uploads per hour.",
          retryAfter: rateLimitResult.retryAfter,
        },
        { status: 429 }
      );
    }

    // --- Parse multipart form ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formData: any = await request.formData();

    const updateData: Record<string, string> = {};
    const errors: string[] = [];

    for (const [fieldName, dbColumn] of Object.entries(FIELD_MAP)) {
      const file = formData.get(fieldName);
      if (!file || !(file instanceof File)) continue;

      const buffer = Buffer.from(await file.arrayBuffer());
      const validation = validateUploadedFile(buffer, file.type, file.size);

      if (!validation.valid) {
        errors.push(`${fieldName}: ${validation.error}`);
        continue;
      }

      const { fileUrl } = await saveFile(
        buffer,
        driver.organizationId,
        file.name,
        file.type
      );

      updateData[dbColumn] = fileUrl;
    }

    if (errors.length > 0 && Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "All files failed validation", details: errors },
        { status: 400 }
      );
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          error:
            "At least one file is required (cdlFront, cdlBack, or medicalCert)",
        },
        { status: 400 }
      );
    }

    // --- Update DriverProfile ---
    const updated = await db.driverProfile.update({
      where: { userId: id },
      data: updateData,
      select: {
        cdlFrontUrl: true,
        cdlBackUrl: true,
        medicalCertUrl: true,
      },
    });

    return NextResponse.json({
      success: true,
      updated,
      ...(errors.length > 0 && { warnings: errors }),
    });
  } catch (error) {
    return handleApiError(error, "CDL upload error");
  }
}
