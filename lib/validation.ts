/**
 * Input Validation & Sanitization Utilities
 *
 * Sprint 9 - Story 9.4: Input Validation
 *
 * Provides comprehensive validation and sanitization functions to prevent:
 * - XSS attacks
 * - Path traversal
 * - SQL injection (via Prisma, but additional layer)
 * - Invalid data formats
 * - Data integrity issues
 */

import { z } from "zod";
import { NextResponse } from "next/server";

/**
 * Email validation
 * RFC 5322 compliant with additional security checks
 */
export const emailSchema = z
  .string()
  .email("Invalid email format")
  .min(5, "Email must be at least 5 characters")
  .max(254, "Email must not exceed 254 characters")
  .toLowerCase()
  .refine(
    (email) => {
      // Additional checks: no consecutive dots, no leading/trailing dots
      return !/\.\./.test(email) && !/^\./.test(email) && !/\.$/.test(email);
    },
    { message: "Invalid email format" }
  );

/**
 * Validate email address
 * @param email Email address to validate
 * @returns true if valid, false otherwise
 */
export function validateEmail(email: string): boolean {
  try {
    emailSchema.parse(email);
    return true;
  } catch {
    return false;
  }
}

/**
 * Phone number validation (Ethiopian format)
 * Accepts: +251912345678, 0912345678, 912345678
 */
export const phoneSchema = z
  .string()
  .min(9, "Phone number must be at least 9 digits")
  .max(15, "Phone number must not exceed 15 characters")
  .refine(
    (phone) => {
      // Remove spaces and dashes
      const cleaned = phone.replace(/[\s\-]/g, "");

      // Ethiopian format: starts with +251, 0, or 9
      const ethiopianPattern = /^(\+251|0)?9\d{8}$/;

      return ethiopianPattern.test(cleaned);
    },
    { message: "Invalid Ethiopian phone number format" }
  );

/**
 * Validate phone number
 * @param phone Phone number to validate
 * @returns true if valid, false otherwise
 */
export function validatePhoneNumber(phone: string): boolean {
  try {
    phoneSchema.parse(phone);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize text input to prevent XSS attacks
 * Removes HTML tags and dangerous characters
 */
export function sanitizeText(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, "");

  // Remove script-related content
  sanitized = sanitized.replace(/javascript:/gi, "");
  sanitized = sanitized.replace(/on\w+\s*=/gi, "");

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, " ").trim();

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Validate and sanitize file name
 * Prevents path traversal and special character attacks
 */
export function validateFileName(fileName: string): {
  valid: boolean;
  error?: string;
  sanitized?: string;
} {
  if (!fileName || typeof fileName !== "string") {
    return { valid: false, error: "File name is required" };
  }

  // Check length
  if (fileName.length > 255) {
    return { valid: false, error: "File name too long (max 255 characters)" };
  }

  // Check for path traversal attempts
  if (
    fileName.includes("..") ||
    fileName.includes("/") ||
    fileName.includes("\\")
  ) {
    return { valid: false, error: "File name contains invalid characters" };
  }

  // Check for null bytes
  if (fileName.includes("\0")) {
    return { valid: false, error: "File name contains null bytes" };
  }

  // Only allow alphanumeric, dash, underscore, dot, and space
  const validPattern = /^[a-zA-Z0-9\-_\.\s]+$/;
  if (!validPattern.test(fileName)) {
    return { valid: false, error: "File name contains invalid characters" };
  }

  // Must have an extension
  if (!fileName.includes(".")) {
    return { valid: false, error: "File name must have an extension" };
  }

  // Sanitize: remove multiple consecutive spaces/dots
  let sanitized = fileName.replace(/\s+/g, " ").replace(/\.+/g, ".");
  sanitized = sanitized.trim();

  return { valid: true, sanitized };
}

/**
 * Numeric range validation
 */
export function validateNumericRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): { valid: boolean; error?: string } {
  if (typeof value !== "number" || isNaN(value)) {
    return { valid: false, error: `${fieldName} must be a valid number` };
  }

  if (!isFinite(value)) {
    return { valid: false, error: `${fieldName} must be a finite number` };
  }

  if (value < min || value > max) {
    return {
      valid: false,
      error: `${fieldName} must be between ${min} and ${max}`,
    };
  }

  return { valid: true };
}

/**
 * Date validation
 */
export function validateDateRange(
  startDate: Date,
  endDate: Date,
  fieldNames: { start: string; end: string }
): { valid: boolean; error?: string } {
  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
    return { valid: false, error: `${fieldNames.start} must be a valid date` };
  }

  if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
    return { valid: false, error: `${fieldNames.end} must be a valid date` };
  }

  if (startDate >= endDate) {
    return {
      valid: false,
      error: `${fieldNames.end} must be after ${fieldNames.start}`,
    };
  }

  return { valid: true };
}

/**
 * Validate date is not in the past
 */
export function validateFutureDate(
  date: Date,
  fieldName: string,
  allowToday: boolean = true
): { valid: boolean; error?: string } {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return { valid: false, error: `${fieldName} must be a valid date` };
  }

  const now = new Date();
  if (allowToday) {
    now.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
  }

  if (date < now) {
    return {
      valid: false,
      error: `${fieldName} cannot be in the past`,
    };
  }

  return { valid: true };
}

/**
 * Sanitize rejection reason or notes
 * Allows more characters but prevents XSS
 */
export function sanitizeRejectionReason(reason: string): string {
  if (!reason) return "";

  // Remove HTML tags
  let sanitized = reason.replace(/<[^>]*>/g, "");

  // Remove script content
  sanitized = sanitized.replace(/javascript:/gi, "");
  sanitized = sanitized.replace(/on\w+\s*=/gi, "");

  // Normalize whitespace but preserve newlines
  sanitized = sanitized.replace(/[ \t]+/g, " ");

  // Limit to 500 characters
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 500);
  }

  return sanitized.trim();
}

/**
 * Validate UUID format
 */
export function validateUUID(id: string): boolean {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(id);
}

/**
 * Validate ID format (cuid or uuid)
 */
export function validateIdFormat(
  id: string,
  fieldName: string = "ID"
): {
  valid: boolean;
  error?: string;
} {
  if (!id || typeof id !== "string") {
    return { valid: false, error: `${fieldName} is required` };
  }

  // Check length (cuid is typically 25 chars, uuid is 36)
  if (id.length < 10 || id.length > 50) {
    return { valid: false, error: `Invalid ${fieldName} format` };
  }

  // Check for SQL injection attempts
  const sqlPatterns =
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b|--|;|\/\*|\*\/)/i;
  if (sqlPatterns.test(id)) {
    return { valid: false, error: `Invalid ${fieldName} format` };
  }

  // Only allow alphanumeric and dashes
  if (!/^[a-zA-Z0-9\-]+$/.test(id)) {
    return { valid: false, error: `Invalid ${fieldName} format` };
  }

  return { valid: true };
}

/**
 * Weight validation (in kg)
 * Typical truck capacity: 100kg - 50,000kg
 */
export const weightSchema = z
  .number()
  .positive("Weight must be positive")
  .min(1, "Weight must be at least 1 kg")
  .max(50000, "Weight must not exceed 50,000 kg")
  .finite("Weight must be a finite number");

/**
 * Length validation (in meters)
 * Typical truck length: 1m - 20m
 */
export const lengthSchema = z
  .number()
  .positive("Length must be positive")
  .min(0.1, "Length must be at least 0.1 m")
  .max(20, "Length must not exceed 20 m")
  .finite("Length must be a finite number");

/**
 * Distance validation (in kilometers)
 * Typical deadhead: 0 - 1000km
 */
export const distanceSchema = z
  .number()
  .nonnegative("Distance must be non-negative")
  .max(2000, "Distance must not exceed 2,000 km")
  .finite("Distance must be a finite number");

/**
 * File size validation (in bytes)
 */
export function validateFileSize(
  size: number,
  maxSizeMB: number = 10
): { valid: boolean; error?: string } {
  const maxBytes = maxSizeMB * 1024 * 1024;

  if (typeof size !== "number" || size <= 0) {
    return { valid: false, error: "Invalid file size" };
  }

  if (size > maxBytes) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Password validation
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
export function validatePassword(password: string): boolean {
  if (!password || typeof password !== "string") {
    return false;
  }

  if (password.length < 8) {
    return false;
  }

  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    return false;
  }

  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    return false;
  }

  // Check for at least one number
  if (!/[0-9]/.test(password)) {
    return false;
  }

  // Check for at least one special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return false;
  }

  return true;
}

/**
 * Sanitize Zod validation errors for safe client exposure
 * Prevents internal schema details from leaking to attackers
 */
export function sanitizeZodError(error: z.ZodError): {
  error: string;
  fields: { field: string; message: string }[];
} {
  return {
    error: "Validation error",
    fields: error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  };
}

/**
 * Create a NextResponse for Zod validation errors
 * Use this in API routes to return consistent, safe error responses
 *
 * @example
 * if (error instanceof z.ZodError) {
 *   return zodErrorResponse(error);
 * }
 */
export function zodErrorResponse(error: z.ZodError): NextResponse {
  return NextResponse.json(sanitizeZodError(error), { status: 400 });
}
