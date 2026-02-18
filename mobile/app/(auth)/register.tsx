/**
 * Register Screen
 * Ported from Flutter's register_screen.dart (401 LOC)
 * Supports role tabs (Carrier/Shipper/Dispatcher) with dynamic fields
 */
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
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
import { spacing, borderRadius } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

const registerSchema = z
  .object({
    email: z.string().min(1, "Email is required").email("Invalid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm password"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    phone: z.string().min(1, "Phone number is required"),
    companyName: z.string().min(1, "Company name is required"),
    carrierType: z.string().optional(),
    associationId: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;
type RoleTab = "CARRIER" | "SHIPPER" | "DISPATCHER";

export default function RegisterScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [selectedRole, setSelectedRole] = useState<RoleTab>("CARRIER");

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      phone: "",
      companyName: "",
      carrierType: "",
      associationId: "",
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    clearError();
    try {
      await register({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: selectedRole,
        companyName: data.companyName,
        carrierType: selectedRole === "CARRIER" ? data.carrierType : undefined,
        associationId:
          selectedRole === "CARRIER" ? data.associationId : undefined,
      });
    } catch {
      // Error is set in store
    }
  };

  const roles: {
    key: RoleTab;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    { key: "CARRIER", label: t("auth.roleCarrier"), icon: "bus-outline" },
    { key: "SHIPPER", label: t("auth.roleShipper"), icon: "cube-outline" },
    {
      key: "DISPATCHER",
      label: t("auth.roleDispatcher"),
      icon: "git-network-outline",
    },
  ];

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
          <Text style={styles.title}>{t("auth.registerTitle")}</Text>
          <Text style={styles.subtitle}>{t("auth.registerSubtitle")}</Text>
        </View>

        {/* Role Tabs */}
        <View style={styles.roleTabs}>
          {roles.map((role) => (
            <TouchableOpacity
              key={role.key}
              style={[
                styles.roleTab,
                selectedRole === role.key && styles.roleTabActive,
              ]}
              onPress={() => setSelectedRole(role.key)}
              testID={`role-${role.key.toLowerCase()}`}
            >
              <Ionicons
                name={role.icon}
                size={20}
                color={
                  selectedRole === role.key ? colors.white : colors.slate500
                }
              />
              <Text
                style={[
                  styles.roleTabText,
                  selectedRole === role.key && styles.roleTabTextActive,
                ]}
              >
                {role.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Controller
                control={control}
                name="firstName"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label={t("auth.firstName")}
                    value={value}
                    onChangeText={onChange}
                    error={errors.firstName?.message}
                    required
                    testID="register-firstName"
                  />
                )}
              />
            </View>
            <View style={styles.halfField}>
              <Controller
                control={control}
                name="lastName"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label={t("auth.lastName")}
                    value={value}
                    onChangeText={onChange}
                    error={errors.lastName?.message}
                    required
                    testID="register-lastName"
                  />
                )}
              />
            </View>
          </View>

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, value } }) => (
              <Input
                label={t("auth.email")}
                value={value}
                onChangeText={onChange}
                error={errors.email?.message}
                keyboardType="email-address"
                autoCapitalize="none"
                required
                testID="register-email"
              />
            )}
          />

          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, value } }) => (
              <Input
                label={t("auth.phone")}
                value={value}
                onChangeText={onChange}
                error={errors.phone?.message}
                keyboardType="phone-pad"
                required
                testID="register-phone"
              />
            )}
          />

          <Controller
            control={control}
            name="companyName"
            render={({ field: { onChange, value } }) => (
              <Input
                label={t("auth.companyName")}
                value={value}
                onChangeText={onChange}
                error={errors.companyName?.message}
                required
                testID="register-companyName"
              />
            )}
          />

          {/* Carrier-specific fields */}
          {selectedRole === "CARRIER" && (
            <>
              <Controller
                control={control}
                name="carrierType"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label={t("auth.carrierType")}
                    value={value ?? ""}
                    onChangeText={onChange}
                    hint="e.g., CARRIER_COMPANY, CARRIER_INDIVIDUAL"
                    testID="register-carrierType"
                  />
                )}
              />
              <Controller
                control={control}
                name="associationId"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label={t("auth.associationId")}
                    value={value ?? ""}
                    onChangeText={onChange}
                    hint="Optional: your transport association ID"
                    testID="register-associationId"
                  />
                )}
              />
            </>
          )}

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
              <Input
                label={t("auth.password")}
                value={value}
                onChangeText={onChange}
                error={errors.password?.message}
                isPassword
                required
                testID="register-password"
              />
            )}
          />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, value } }) => (
              <Input
                label={t("auth.confirmPassword")}
                value={value}
                onChangeText={onChange}
                error={errors.confirmPassword?.message}
                isPassword
                required
                testID="register-confirmPassword"
              />
            )}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            title={t("auth.register")}
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            fullWidth
            size="lg"
            testID="register-submit"
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t("auth.hasAccount")} </Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.footerLink}>{t("auth.signIn")}</Text>
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
    padding: spacing["2xl"],
    paddingTop: spacing["4xl"],
  },
  header: {
    alignItems: "center",
    marginBottom: spacing["2xl"],
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
  roleTabs: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing["2xl"],
  },
  roleTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.slate100,
  },
  roleTabActive: {
    backgroundColor: colors.primary600,
  },
  roleTabText: {
    ...typography.labelMedium,
    color: colors.slate500,
  },
  roleTabTextActive: {
    color: colors.white,
  },
  form: {
    marginBottom: spacing["2xl"],
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  halfField: {
    flex: 1,
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
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: spacing["2xl"],
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
