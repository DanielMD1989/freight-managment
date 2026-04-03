/**
 * StarRating — Mobile 1-5 star display/selector
 * §12 Ratings & Reviews
 */
import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  color?: string;
}

export default function StarRating({
  value,
  onChange,
  size = 28,
  color = "#F59E0B",
}: StarRatingProps) {
  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          disabled={!onChange}
          onPress={() => onChange?.(star)}
          activeOpacity={onChange ? 0.6 : 1}
        >
          <Ionicons
            name={star <= value ? "star" : "star-outline"}
            size={size}
            color={star <= value ? color : "#CBD5E1"}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});
