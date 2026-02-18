/**
 * Login Screen
 * Ported from Flutter's login_screen.dart (409 LOC)
 */
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../src/stores/auth";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { login, verifyMfa, isLoading, error, mfaPending, clearError } =
    useAuthStore();
  const [mfaCode, setMfaCode] = useState("");

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginForm) => {
    clearError();
    try {
      await login(data.email, data.password);
    } catch {
      // Error is set in store
    }
  };

  const onMfaSubmit = async () => {
    if (mfaCode.length < 6) {
      Alert.alert("Error", "Please enter a valid 6-digit code");
      return;
    }
    try {
      await verifyMfa(mfaCode);
    } catch {
      // Error is set in store
    }
  };

  // MFA verification screen
  if (mfaPending) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Ionicons
              name="shield-checkmark"
              size={64}
              color={colors.primary500}
            />
            <Text style={styles.title}>{t("auth.mfaTitle")}</Text>
            <Text style={styles.subtitle}>{t("auth.mfaSubtitle")}</Text>
          </View>

          <View style={styles.form}>
            <Input
              label={t("auth.mfaCode")}
              value={mfaCode}
              onChangeText={setMfaCode}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="000000"
              leftIcon={
                <Ionicons
                  name="key-outline"
                  size={20}
                  color={colors.slate400}
                />
              }
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Button
              title={t("auth.verify")}
              onPress={onMfaSubmit}
              loading={isLoading}
              fullWidth
              size="lg"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="cube" size={48} color={colors.primary500} />
          </View>
          <Text style={styles.title}>{t("auth.loginTitle")}</Text>
          <Text style={styles.subtitle}>{t("auth.loginSubtitle")}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t("auth.email")}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email?.message}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="you@example.com"
                leftIcon={
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={colors.slate400}
                  />
                }
                testID="login-email"
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t("auth.password")}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
                isPassword
                autoCapitalize="none"
                autoComplete="password"
                placeholder="Enter your password"
                leftIcon={
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={colors.slate400}
                  />
                }
                testID="login-password"
              />
            )}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            title={t("auth.login")}
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            fullWidth
            size="lg"
            testID="login-submit"
          />

          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>
              {t("auth.forgotPassword")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t("auth.noAccount")} </Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
            <Text style={styles.footerLink}>{t("auth.signUp")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing["2xl"],
  },
  header: {
    alignItems: "center",
    marginBottom: spacing["3xl"],
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.primary50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.displaySmall,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
  },
  form: {
    marginBottom: spacing["2xl"],
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    textAlign: "center",
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.errorLight,
    borderRadius: 8,
    overflow: "hidden",
  },
  forgotPassword: {
    alignItems: "center",
    marginTop: spacing.lg,
  },
  forgotPasswordText: {
    ...typography.bodyMedium,
    color: colors.primary600,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  footerLink: {
    ...typography.labelLarge,
    color: colors.primary600,
  },
});
