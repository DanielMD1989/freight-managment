/**
 * Onboarding Screen - 4-page intro with Skip/Next
 * Ported from Flutter's onboarding_screen.dart (461 LOC)
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Dimensions,
  ViewToken,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../src/stores/settings";
import { Button } from "../src/components/Button";
import { colors } from "../src/theme/colors";
import { spacing } from "../src/theme/spacing";
import { typography } from "../src/theme/typography";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Slide {
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  bodyKey: string;
  color: string;
}

const slides: Slide[] = [
  {
    icon: "search",
    titleKey: "onboarding.slide1Title",
    bodyKey: "onboarding.slide1Body",
    color: colors.primary500,
  },
  {
    icon: "location",
    titleKey: "onboarding.slide2Title",
    bodyKey: "onboarding.slide2Body",
    color: colors.accent500,
  },
  {
    icon: "bus",
    titleKey: "onboarding.slide3Title",
    bodyKey: "onboarding.slide3Body",
    color: colors.success,
  },
  {
    icon: "shield-checkmark",
    titleKey: "onboarding.slide4Title",
    bodyKey: "onboarding.slide4Body",
    color: colors.info,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const setOnboardingCompleted = useSettingsStore(
    (s) => s.setOnboardingCompleted
  );
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    []
  );

  const viewabilityConfig = useMemo(
    () => ({ viewAreaCoveragePercentThreshold: 50 }),
    []
  );

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      handleGetStarted();
    }
  };

  const handleGetStarted = async () => {
    await setOnboardingCompleted();
    router.replace("/(auth)/login");
  };

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      <View style={[styles.iconCircle, { backgroundColor: `${item.color}20` }]}>
        <Ionicons name={item.icon} size={80} color={item.color} />
      </View>
      <Text style={styles.slideTitle}>{t(item.titleKey)}</Text>
      <Text style={styles.slideBody}>{t(item.bodyKey)}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyExtractor={(_, i) => String(i)}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Dots */}
      <View style={styles.dotsContainer}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === currentIndex && styles.dotActive]}
          />
        ))}
      </View>

      {/* Buttons */}
      <View style={styles.buttons}>
        <Button
          title={t("common.skip")}
          onPress={handleGetStarted}
          variant="ghost"
          size="md"
        />
        <Button
          title={
            currentIndex === slides.length - 1
              ? t("onboarding.getStarted")
              : t("common.next")
          }
          onPress={handleNext}
          variant="primary"
          size="lg"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  slide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing["3xl"],
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing["3xl"],
  },
  slideTitle: {
    ...typography.displayMedium,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  slideBody: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing["2xl"],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.slate300,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary500,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing["2xl"],
    paddingBottom: spacing["4xl"],
  },
});
