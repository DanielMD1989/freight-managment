/**
 * RatingModal — Mobile rating submission for §12 Ratings & Reviews
 *
 * Blueprint §12: "Platforms: Web + Mobile (both shipper and carrier apps)"
 *
 * Triggered from trip detail screens (shipper + carrier) when:
 *   - trip.status is DELIVERED or COMPLETED
 *   - the current user has not yet rated this trip (myRating === null)
 *
 * Submits via useSubmitRating(); ratings are immutable per Blueprint §12.
 */

import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import StarRating from "./StarRating";
import { useSubmitRating } from "../hooks/useRatings";
import { colors } from "../theme/colors";
import { spacing, borderRadius } from "../theme/spacing";
import { typography } from "../theme/typography";

interface RatingModalProps {
  visible: boolean;
  tripId: string;
  ratedOrgName: string;
  raterLabel: string; // "Rate Carrier" or "Rate Shipper"
  driverName?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const COMMENT_MAX = 300;

export default function RatingModal({
  visible,
  tripId,
  ratedOrgName,
  raterLabel,
  driverName,
  onClose,
  onSuccess,
}: RatingModalProps) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submitMutation = useSubmitRating();

  function reset() {
    setStars(0);
    setComment("");
    setError(null);
  }

  function handleClose() {
    if (submitMutation.isPending) return;
    reset();
    onClose();
  }

  async function handleSubmit() {
    setError(null);
    if (stars < 1 || stars > 5) {
      setError("Please select a rating from 1 to 5 stars");
      return;
    }
    try {
      await submitMutation.mutateAsync({
        tripId,
        data: {
          stars,
          comment: comment.trim() || undefined,
        },
      });
      reset();
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit rating");
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{raterLabel}</Text>
            <TouchableOpacity
              onPress={handleClose}
              disabled={submitMutation.isPending}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>{ratedOrgName}</Text>
          {driverName && (
            <Text style={styles.driverName}>Driver: {driverName}</Text>
          )}

          <View style={styles.starRow}>
            <StarRating value={stars} onChange={setStars} size={40} />
          </View>

          <Text style={styles.label}>Comment (optional)</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={4}
            placeholder="Tell them how the trip went…"
            placeholderTextColor={colors.textTertiary}
            value={comment}
            onChangeText={(t) =>
              setComment(t.length > COMMENT_MAX ? t.slice(0, COMMENT_MAX) : t)
            }
            editable={!submitMutation.isPending}
            maxLength={COMMENT_MAX}
          />
          <Text style={styles.charCount}>
            {comment.length}/{COMMENT_MAX}
          </Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={submitMutation.isPending}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.submitButton,
                (stars === 0 || submitMutation.isPending) &&
                  styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={stars === 0 || submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    ...typography.titleLarge,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  driverName: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  starRow: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.labelLarge,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  textArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    minHeight: 96,
    textAlignVertical: "top",
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  charCount: {
    ...typography.labelLarge,
    color: colors.textTertiary,
    textAlign: "right",
    marginTop: spacing.xs,
  },
  errorText: {
    ...typography.labelLarge,
    color: colors.error,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  button: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  submitButton: {
    backgroundColor: colors.primary500,
    minWidth: 100,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: "600",
  },
});
