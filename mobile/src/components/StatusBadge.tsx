/**
 * Status-specific badge that auto-maps status strings to colors
 */
import React from "react";
import { Badge, getStatusVariant } from "./Badge";
import { formatLoadStatus, formatTripStatus } from "../utils/format";
import { ViewStyle } from "react-native";

interface StatusBadgeProps {
  status: string;
  type?: "load" | "trip" | "generic";
  size?: "sm" | "md";
  style?: ViewStyle;
}

export function StatusBadge({
  status,
  type = "generic",
  size = "sm",
  style,
}: StatusBadgeProps) {
  const variant = getStatusVariant(status);
  let label: string;

  switch (type) {
    case "load":
      label = formatLoadStatus(status);
      break;
    case "trip":
      label = formatTripStatus(status);
      break;
    default:
      label = status
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return <Badge label={label} variant={variant} size={size} style={style} />;
}
