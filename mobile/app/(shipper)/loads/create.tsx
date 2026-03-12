/**
 * Create Load Screen (Shipper) - Multi-step form matching web parity
 * Steps: Route → Cargo → Options → Review
 */
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Switch,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useCreateLoad } from "../../../src/hooks/useLoads";
import { Input } from "../../../src/components/Input";
import { Button } from "../../../src/components/Button";
import { Card } from "../../../src/components/Card";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";

const TRUCK_TYPES = [
  "FLATBED",
  "REFRIGERATED",
  "TANKER",
  "CONTAINER",
  "DRY_VAN",
  "LOWBOY",
  "DUMP_TRUCK",
  "BOX_TRUCK",
] as const;

const loadSchema = z.object({
  // Step 1: Route
  pickupCity: z.string().min(1, "Pickup city is required"),
  deliveryCity: z.string().min(1, "Delivery city is required"),
  pickupDate: z.string().min(1, "Pickup date is required"),
  deliveryDate: z.string().min(1, "Delivery date is required"),
  pickupAddress: z.string().optional(),
  deliveryAddress: z.string().optional(),
  appointmentRequired: z.boolean().optional(),
  // Step 2: Cargo
  truckType: z.string().min(1, "Truck type is required"),
  weight: z.string().min(1, "Weight is required"),
  volume: z.string().optional(),
  cargoDescription: z.string().min(1, "Cargo description is required"),
  fullPartial: z.string().optional(),
  isFragile: z.boolean().optional(),
  requiresRefrigeration: z.boolean().optional(),
  // Step 3: Options
  bookMode: z.string().optional(),
  isAnonymous: z.boolean().optional(),
  shipperContactName: z.string().optional(),
  shipperContactPhone: z.string().optional(),
  specialInstructions: z.string().optional(),
  status: z.string().optional(),
});

type LoadForm = z.infer<typeof loadSchema>;

const STEPS = ["Route", "Cargo", "Options", "Review"];

export default function CreateLoadScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const createLoad = useCreateLoad();
  const [step, setStep] = useState(0);

  const {
    control,
    handleSubmit,
    watch,
    trigger,
    formState: { errors },
  } = useForm<LoadForm>({
    resolver: zodResolver(loadSchema),
    defaultValues: {
      pickupCity: "",
      deliveryCity: "",
      pickupDate: "",
      deliveryDate: "",
      pickupAddress: "",
      deliveryAddress: "",
      appointmentRequired: false,
      truckType: "FLATBED",
      weight: "",
      volume: "",
      cargoDescription: "",
      fullPartial: "FULL",
      isFragile: false,
      requiresRefrigeration: false,
      bookMode: "REQUEST",
      isAnonymous: false,
      shipperContactName: "",
      shipperContactPhone: "",
      specialInstructions: "",
      status: "POSTED",
    },
  });

  const formValues = watch();

  const stepFields: Record<number, (keyof LoadForm)[]> = {
    0: ["pickupCity", "deliveryCity", "pickupDate", "deliveryDate"],
    1: ["truckType", "weight", "cargoDescription"],
    2: [],
    3: [],
  };

  const goNext = async () => {
    const fields = stepFields[step] ?? [];
    if (fields.length > 0) {
      const valid = await trigger(fields);
      if (!valid) return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    if (step === 0) {
      router.back();
    } else {
      setStep((s) => s - 1);
    }
  };

  const onSubmit = (data: LoadForm) => {
    createLoad.mutate(
      {
        pickupCity: data.pickupCity,
        deliveryCity: data.deliveryCity,
        pickupDate: data.pickupDate,
        deliveryDate: data.deliveryDate,
        truckType: data.truckType,
        weight: parseFloat(data.weight),
        cargoDescription: data.cargoDescription,
        fullPartial: data.fullPartial || "FULL",
        bookMode: data.bookMode || "REQUEST",
        isFragile: data.isFragile ?? false,
        requiresRefrigeration: data.requiresRefrigeration ?? false,
        isAnonymous: data.isAnonymous ?? false,
        appointmentRequired: data.appointmentRequired ?? false,
        volume: data.volume ? parseFloat(data.volume) : undefined,
        shipperContactName: data.shipperContactName || undefined,
        shipperContactPhone: data.shipperContactPhone || undefined,
        pickupAddress: data.pickupAddress || undefined,
        deliveryAddress: data.deliveryAddress || undefined,
        specialInstructions: data.specialInstructions || undefined,
        status: data.status || "POSTED",
      },
      {
        onSuccess: () => {
          Alert.alert("Success", "Load created!");
          router.back();
        },
        onError: (err) => Alert.alert("Error", err.message),
      }
    );
  };

  return (
    <View style={styles.container}>
      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        {STEPS.map((label, i) => (
          <View key={label} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                i <= step && styles.stepDotActive,
                i < step && styles.stepDotCompleted,
              ]}
            >
              {i < step ? (
                <Ionicons name="checkmark" size={14} color={colors.white} />
              ) : (
                <Text
                  style={[
                    styles.stepNumber,
                    i <= step && styles.stepNumberActive,
                  ]}
                >
                  {i + 1}
                </Text>
              )}
            </View>
            <Text
              style={[styles.stepLabel, i <= step && styles.stepLabelActive]}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step 1: Route */}
        {step === 0 && (
          <>
            <Controller
              control={control}
              name="pickupCity"
              render={({ field: { onChange, value } }) => (
                <Input
                  label={t("load.pickupCity")}
                  value={value}
                  onChangeText={onChange}
                  error={errors.pickupCity?.message}
                  required
                />
              )}
            />
            <Controller
              control={control}
              name="deliveryCity"
              render={({ field: { onChange, value } }) => (
                <Input
                  label={t("load.deliveryCity")}
                  value={value}
                  onChangeText={onChange}
                  error={errors.deliveryCity?.message}
                  required
                />
              )}
            />
            <Controller
              control={control}
              name="pickupDate"
              render={({ field: { onChange, value } }) => (
                <Input
                  label={t("load.pickupDate")}
                  value={value}
                  onChangeText={onChange}
                  error={errors.pickupDate?.message}
                  hint="YYYY-MM-DD"
                  required
                />
              )}
            />
            <Controller
              control={control}
              name="deliveryDate"
              render={({ field: { onChange, value } }) => (
                <Input
                  label={t("load.deliveryDate")}
                  value={value}
                  onChangeText={onChange}
                  error={errors.deliveryDate?.message}
                  hint="YYYY-MM-DD"
                  required
                />
              )}
            />
            <Controller
              control={control}
              name="pickupAddress"
              render={({ field: { onChange, value } }) => (
                <Input
                  label={t("load.pickupAddress")}
                  value={value ?? ""}
                  onChangeText={onChange}
                />
              )}
            />
            <Controller
              control={control}
              name="deliveryAddress"
              render={({ field: { onChange, value } }) => (
                <Input
                  label={t("load.deliveryAddress")}
                  value={value ?? ""}
                  onChangeText={onChange}
                />
              )}
            />
            <Controller
              control={control}
              name="appointmentRequired"
              render={({ field: { onChange, value } }) => (
                <SwitchRow
                  label={t("load.appointmentRequired")}
                  value={value ?? false}
                  onValueChange={onChange}
                />
              )}
            />
          </>
        )}

        {/* Step 2: Cargo */}
        {step === 1 && (
          <>
            <Text style={styles.fieldLabel}>{t("load.truckType")} *</Text>
            <Controller
              control={control}
              name="truckType"
              render={({ field: { onChange, value } }) => (
                <View style={styles.chipGrid}>
                  {TRUCK_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.chip, value === type && styles.chipActive]}
                      onPress={() => onChange(type)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          value === type && styles.chipTextActive,
                        ]}
                      >
                        {type.replace(/_/g, " ")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />
            <Controller
              control={control}
              name="weight"
              render={({ field: { onChange, value } }) => (
                <Input
                  label={t("load.weight")}
                  value={value}
                  onChangeText={onChange}
                  error={errors.weight?.message}
                  keyboardType="numeric"
                  required
                />
              )}
            />
            <Controller
              control={control}
              name="volume"
              render={({ field: { onChange, value } }) => (
                <Input
                  label={t("load.volume")}
                  value={value ?? ""}
                  onChangeText={onChange}
                  keyboardType="numeric"
                />
              )}
            />
            <Controller
              control={control}
              name="cargoDescription"
              render={({ field: { onChange, value } }) => (
                <Input
                  label={t("load.cargo")}
                  value={value}
                  onChangeText={onChange}
                  error={errors.cargoDescription?.message}
                  multiline
                  numberOfLines={3}
                  required
                />
              )}
            />
            <Text style={styles.fieldLabel}>{t("load.fullPartial")}</Text>
            <Controller
              control={control}
              name="fullPartial"
              render={({ field: { onChange, value } }) => (
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      value === "FULL" && styles.toggleBtnActive,
                    ]}
                    onPress={() => onChange("FULL")}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        value === "FULL" && styles.toggleTextActive,
                      ]}
                    >
                      Full
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      value === "PARTIAL" && styles.toggleBtnActive,
                    ]}
                    onPress={() => onChange("PARTIAL")}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        value === "PARTIAL" && styles.toggleTextActive,
                      ]}
                    >
                      Partial
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            />
            <Controller
              control={control}
              name="isFragile"
              render={({ field: { onChange, value } }) => (
                <SwitchRow
                  label={t("load.fragile")}
                  value={value ?? false}
                  onValueChange={onChange}
                />
              )}
            />
            <Controller
              control={control}
              name="requiresRefrigeration"
              render={({ field: { onChange, value } }) => (
                <SwitchRow
                  label={t("load.refrigeration")}
                  value={value ?? false}
                  onValueChange={onChange}
                />
              )}
            />
          </>
        )}

        {/* Step 3: Options */}
        {step === 2 && (
          <>
            <Text style={styles.fieldLabel}>{t("load.bookMode")}</Text>
            <Controller
              control={control}
              name="bookMode"
              render={({ field: { onChange, value } }) => (
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      value === "REQUEST" && styles.toggleBtnActive,
                    ]}
                    onPress={() => onChange("REQUEST")}
                  >
                    <Ionicons
                      name="hand-left-outline"
                      size={16}
                      color={
                        value === "REQUEST"
                          ? colors.white
                          : colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.toggleText,
                        value === "REQUEST" && styles.toggleTextActive,
                      ]}
                    >
                      {t("load.request")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      value === "INSTANT" && styles.toggleBtnActive,
                    ]}
                    onPress={() => onChange("INSTANT")}
                  >
                    <Ionicons
                      name="flash-outline"
                      size={16}
                      color={
                        value === "INSTANT"
                          ? colors.white
                          : colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.toggleText,
                        value === "INSTANT" && styles.toggleTextActive,
                      ]}
                    >
                      {t("load.instant")}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            />
            <Controller
              control={control}
              name="isAnonymous"
              render={({ field: { onChange, value } }) => (
                <SwitchRow
                  label={t("load.anonymous")}
                  value={value ?? false}
                  onValueChange={onChange}
                />
              )}
            />
            {!formValues.isAnonymous && (
              <>
                <Controller
                  control={control}
                  name="shipperContactName"
                  render={({ field: { onChange, value } }) => (
                    <Input
                      label={t("load.contactName")}
                      value={value ?? ""}
                      onChangeText={onChange}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="shipperContactPhone"
                  render={({ field: { onChange, value } }) => (
                    <Input
                      label={t("load.contactPhone")}
                      value={value ?? ""}
                      onChangeText={onChange}
                      keyboardType="phone-pad"
                    />
                  )}
                />
              </>
            )}
            <Controller
              control={control}
              name="specialInstructions"
              render={({ field: { onChange, value } }) => (
                <Input
                  label={t("load.specialInstructions")}
                  value={value ?? ""}
                  onChangeText={onChange}
                  multiline
                  numberOfLines={2}
                />
              )}
            />
            <Text style={styles.fieldLabel}>{t("load.status")}</Text>
            <Controller
              control={control}
              name="status"
              render={({ field: { onChange, value } }) => (
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      value === "POSTED" && styles.toggleBtnActive,
                    ]}
                    onPress={() => onChange("POSTED")}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        value === "POSTED" && styles.toggleTextActive,
                      ]}
                    >
                      {t("load.posted")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      value === "DRAFT" && styles.toggleBtnActive,
                    ]}
                    onPress={() => onChange("DRAFT")}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        value === "DRAFT" && styles.toggleTextActive,
                      ]}
                    >
                      {t("load.draft")}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          </>
        )}

        {/* Step 4: Review */}
        {step === 3 && (
          <>
            <Card style={styles.reviewCard} variant="outlined">
              <Text style={styles.reviewSection}>Route</Text>
              <ReviewRow
                label="Pickup"
                value={`${formValues.pickupCity}${formValues.pickupAddress ? ` - ${formValues.pickupAddress}` : ""}`}
              />
              <ReviewRow
                label="Delivery"
                value={`${formValues.deliveryCity}${formValues.deliveryAddress ? ` - ${formValues.deliveryAddress}` : ""}`}
              />
              <ReviewRow label="Pickup Date" value={formValues.pickupDate} />
              <ReviewRow
                label="Delivery Date"
                value={formValues.deliveryDate}
              />
              {formValues.appointmentRequired && (
                <ReviewRow label="Appointment" value="Required" />
              )}
            </Card>
            <Card style={styles.reviewCard} variant="outlined">
              <Text style={styles.reviewSection}>Cargo</Text>
              <ReviewRow
                label="Truck Type"
                value={formValues.truckType.replace(/_/g, " ")}
              />
              <ReviewRow label="Weight" value={`${formValues.weight} kg`} />
              {formValues.volume && (
                <ReviewRow label="Volume" value={`${formValues.volume} m³`} />
              )}
              <ReviewRow label="Cargo" value={formValues.cargoDescription} />
              <ReviewRow
                label="Load Type"
                value={
                  formValues.fullPartial === "PARTIAL" ? "Partial" : "Full"
                }
              />
              {formValues.isFragile && (
                <ReviewRow label="Fragile" value="Yes" />
              )}
              {formValues.requiresRefrigeration && (
                <ReviewRow label="Refrigeration" value="Required" />
              )}
            </Card>
            <Card style={styles.reviewCard} variant="outlined">
              <Text style={styles.reviewSection}>Options</Text>
              <ReviewRow
                label="Book Mode"
                value={
                  formValues.bookMode === "INSTANT" ? "Instant" : "Request"
                }
              />
              <ReviewRow
                label="Status"
                value={formValues.status === "DRAFT" ? "Draft" : "Posted"}
              />
              {formValues.isAnonymous && (
                <ReviewRow label="Anonymous" value="Yes" />
              )}
              {formValues.shipperContactName && (
                <ReviewRow
                  label="Contact"
                  value={formValues.shipperContactName}
                />
              )}
              {formValues.specialInstructions && (
                <ReviewRow
                  label="Instructions"
                  value={formValues.specialInstructions}
                />
              )}
            </Card>
          </>
        )}
      </ScrollView>

      {/* Bottom navigation */}
      <View style={styles.bottomBar}>
        <Button
          title={step === 0 ? t("common.cancel") : t("common.back")}
          onPress={goBack}
          variant="outline"
          style={styles.navBtn}
          testID="create-load-back"
        />
        {step < STEPS.length - 1 ? (
          <Button
            title={t("common.next")}
            onPress={goNext}
            variant="primary"
            style={styles.navBtn}
            testID="create-load-next"
          />
        ) : (
          <Button
            title={t("load.createLoad")}
            onPress={handleSubmit(onSubmit)}
            loading={createLoad.isPending}
            variant="primary"
            style={styles.navBtn}
            testID="create-load-submit"
          />
        )}
      </View>
    </View>
  );
}

function SwitchRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.slate200, true: colors.primary300 }}
        thumbColor={value ? colors.primary600 : colors.slate400}
      />
    </View>
  );
}

function ReviewRow({
  label,
  value,
}: {
  label: string;
  value: string | undefined;
}) {
  if (!value) return null;
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  stepIndicator: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing["2xl"],
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepItem: { alignItems: "center", flex: 1 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.slate200,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  stepDotActive: { backgroundColor: colors.primary500 },
  stepDotCompleted: { backgroundColor: colors.success },
  stepNumber: { ...typography.labelSmall, color: colors.textSecondary },
  stepNumberActive: { color: colors.white },
  stepLabel: { ...typography.labelSmall, color: colors.textSecondary },
  stepLabelActive: { color: colors.primary600, fontWeight: "600" },
  scrollView: { flex: 1 },
  content: { padding: spacing["2xl"] },
  fieldLabel: {
    ...typography.labelMedium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipActive: {
    backgroundColor: colors.primary500,
    borderColor: colors.primary500,
  },
  chipText: { ...typography.bodySmall, color: colors.textSecondary },
  chipTextActive: { color: colors.white, fontWeight: "600" },
  toggleRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary500,
    borderColor: colors.primary500,
  },
  toggleText: { ...typography.labelMedium, color: colors.textSecondary },
  toggleTextActive: { color: colors.white },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  switchLabel: { ...typography.bodyMedium, color: colors.textPrimary },
  reviewCard: { marginBottom: spacing.md },
  reviewSection: {
    ...typography.titleSmall,
    color: colors.primary600,
    marginBottom: spacing.sm,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  reviewLabel: { ...typography.bodySmall, color: colors.textSecondary },
  reviewValue: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
    marginLeft: spacing.md,
  },
  bottomBar: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  navBtn: { flex: 1 },
});
