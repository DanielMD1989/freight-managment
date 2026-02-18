/**
 * Badge / Status chip component
 */
import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { colors } from "../theme/colors";
import { borderRadius, spacing } from "../theme/spacing";
import { typography } from "../theme/typography";

type BadgeVariant =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral"
  | "primary";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  style?: ViewStyle;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: colors.successLight, text: colors.successDark },
  warning: { bg: colors.warningLight, text: colors.warningDark },
  error: { bg: colors.errorLight, text: colors.errorDark },
  info: { bg: colors.infoLight, text: colors.infoDark },
  neutral: { bg: colors.slate100, text: colors.slate600 },
  primary: { bg: colors.primary100, text: colors.primary700 },
};

export function Badge({
  label,
  variant = "neutral",
  size = "sm",
  style,
}: BadgeProps) {
  const { bg, text } = variantColors[variant];

  return (
    <View
      style={[
        styles.base,
        size === "sm" ? styles.sm : styles.md,
        { backgroundColor: bg },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          size === "sm" ? styles.textSm : styles.textMd,
          { color: text },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/** Map load/trip status to badge variant */
export function getStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "COMPLETED":
    case "DELIVERED":
    case "ACTIVE":
    case "APPROVED":
      return "success";
    case "IN_TRANSIT":
    case "PICKUP_PENDING":
    case "ASSIGNED":
    case "SEARCHING":
    case "OFFERED":
    case "PENDING":
      return "warning";
    case "CANCELLED":
    case "REJECTED":
    case "EXCEPTION":
    case "EXPIRED":
    case "SUSPENDED":
      return "error";
    case "POSTED":
    case "DRAFT":
      return "info";
    default:
      return "neutral";
  }
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    borderRadius: borderRadius.full,
  },
  sm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  md: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  text: {
    fontWeight: "600",
  } as TextStyle,
  textSm: {
    ...typography.labelSmall,
  },
  textMd: {
    ...typography.labelMedium,
  },
});
