/**
 * Driver Profile Screen — CDL info, availability toggle, edit profile, CDL photos
 */
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Card, Button, Input, LoadingSpinner } from "../../src/components";
import { AuthenticatedImage } from "../../src/components/AuthenticatedImage";
import { colors, spacing, typography } from "../../src/theme";
import { useAuthStore } from "../../src/stores/auth";
import {
  useMyProfile,
  useToggleAvailability,
  useUpdateDriverProfile,
  useUploadCdlPhoto,
} from "../../src/hooks/useDriver";
import { formatDate } from "../../src/utils/format";

export default function DriverProfileScreen() {
  const { user, logout } = useAuthStore();
  const { data, isLoading, refetch } = useMyProfile();
  const toggleAvailability = useToggleAvailability();
  const updateProfile = useUpdateDriverProfile();

  const uploadCdlPhoto = useUploadCdlPhoto();
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [cdlNumber, setCdlNumber] = useState("");
  const [cdlState, setCdlState] = useState("");
  const [cdlExpiry, setCdlExpiry] = useState("");
  const [medicalCertExp, setMedicalCertExp] = useState("");

  if (isLoading || !data) {
    return <LoadingSpinner fullScreen message="Loading profile..." />;
  }

  const profile = data.driverProfile;
  const isAvailable = profile?.isAvailable ?? true;

  const startEdit = () => {
    setCdlNumber(profile?.cdlNumber ?? "");
    setCdlState(profile?.cdlState ?? "");
    setCdlExpiry(
      profile?.cdlExpiry
        ? new Date(profile.cdlExpiry).toISOString().split("T")[0]
        : ""
    );
    setMedicalCertExp(
      profile?.medicalCertExp
        ? new Date(profile.medicalCertExp).toISOString().split("T")[0]
        : ""
    );
    setEditing(true);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    try {
      await updateProfile.mutateAsync({
        driverId: user.id,
        data: {
          cdlNumber: cdlNumber || null,
          cdlState: cdlState || null,
          cdlExpiry: cdlExpiry || null,
          medicalCertExp: medicalCertExp || null,
        },
      });
      setEditing(false);
      refetch();
      Alert.alert("Success", "Profile updated.");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Save failed");
    }
  };

  const handleToggle = async () => {
    if (!user?.id) return;
    await toggleAvailability.mutateAsync({
      driverId: user.id,
      isAvailable: !isAvailable,
    });
    refetch();
  };

  const pickAndUpload = async (
    fieldName: "cdlFront" | "cdlBack" | "medicalCert"
  ) => {
    if (!user?.id) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      setUploadingField(fieldName);
      await uploadCdlPhoto.mutateAsync({
        driverId: user.id,
        fieldName,
        uri: asset.uri,
        fileName: asset.fileName ?? `${fieldName}.jpg`,
        mimeType: asset.mimeType ?? "image/jpeg",
      });
      refetch();
      Alert.alert("Success", "Photo uploaded.");
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Upload failed"
      );
    } finally {
      setUploadingField(null);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} />
      }
    >
      {/* User info */}
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color={colors.primary600} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>
              {[user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
                "Driver"}
            </Text>
            <Text style={styles.meta}>{user?.email}</Text>
          </View>
        </View>
      </Card>

      {/* Availability */}
      <Card style={styles.card}>
        <View style={styles.availRow}>
          <View>
            <Text style={styles.sectionTitle}>Availability</Text>
            <Text
              style={[
                styles.availStatus,
                { color: isAvailable ? colors.success : colors.error },
              ]}
            >
              {isAvailable ? "Available for trips" : "Unavailable"}
            </Text>
          </View>
          <Button
            title={isAvailable ? "Go Offline" : "Go Online"}
            onPress={handleToggle}
            variant={isAvailable ? "destructive" : "primary"}
            size="sm"
            loading={toggleAvailability.isPending}
          />
        </View>
      </Card>

      {/* CDL info */}
      <Card style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>CDL Information</Text>
          {!editing && (
            <Button
              title="Edit"
              onPress={startEdit}
              variant="ghost"
              size="sm"
            />
          )}
        </View>

        {editing ? (
          <>
            <Input
              label="CDL Number"
              value={cdlNumber}
              onChangeText={setCdlNumber}
              placeholder="CDL number"
            />
            <Input
              label="CDL State"
              value={cdlState}
              onChangeText={setCdlState}
              placeholder="e.g. CA"
            />
            <Input
              label="CDL Expiry (YYYY-MM-DD)"
              value={cdlExpiry}
              onChangeText={setCdlExpiry}
              placeholder="2027-06-15"
            />
            <Input
              label="Medical Cert Expiry (YYYY-MM-DD)"
              value={medicalCertExp}
              onChangeText={setMedicalCertExp}
              placeholder="2026-12-31"
            />
            <View style={styles.editActions}>
              <Button
                title="Cancel"
                onPress={() => setEditing(false)}
                variant="ghost"
                size="md"
              />
              <Button
                title="Save"
                onPress={handleSave}
                loading={updateProfile.isPending}
                variant="primary"
                size="md"
                style={{ flex: 1 }}
              />
            </View>
          </>
        ) : (
          <>
            <DetailRow label="CDL Number" value={profile?.cdlNumber ?? "-"} />
            <DetailRow label="CDL State" value={profile?.cdlState ?? "-"} />
            <DetailRow
              label="CDL Expiry"
              value={profile?.cdlExpiry ? formatDate(profile.cdlExpiry) : "-"}
            />
            <DetailRow
              label="Medical Cert Expiry"
              value={
                profile?.medicalCertExp
                  ? formatDate(profile.medicalCertExp)
                  : "-"
              }
            />
          </>
        )}
      </Card>

      {/* CDL Photos */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>CDL Documents</Text>
        {[
          {
            field: "cdlFront" as const,
            label: "CDL Front",
            url: profile?.cdlFrontUrl,
          },
          {
            field: "cdlBack" as const,
            label: "CDL Back",
            url: profile?.cdlBackUrl,
          },
          {
            field: "medicalCert" as const,
            label: "Medical Certificate",
            url: profile?.medicalCertUrl,
          },
        ].map(({ field, label, url }) => (
          <View key={field} style={styles.photoRow}>
            <View style={styles.photoInfo}>
              <Text style={styles.detailLabel}>{label}</Text>
              {url ? (
                <AuthenticatedImage uri={url} style={styles.thumbnail} />
              ) : (
                <Text style={styles.notUploaded}>Not uploaded</Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => pickAndUpload(field)}
              disabled={uploadingField === field}
            >
              {uploadingField === field ? (
                <ActivityIndicator size="small" color={colors.primary600} />
              ) : (
                <>
                  <Ionicons
                    name="cloud-upload-outline"
                    size={16}
                    color={colors.primary600}
                  />
                  <Text style={styles.uploadText}>
                    {url ? "Replace" : "Upload"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ))}
      </Card>

      {/* Logout */}
      <View style={styles.logoutSection}>
        <Button
          title="Log Out"
          onPress={() => {
            Alert.alert("Log Out", "Are you sure?", [
              { text: "Cancel", style: "cancel" },
              { text: "Log Out", style: "destructive", onPress: logout },
            ]);
          }}
          variant="ghost"
          fullWidth
          size="lg"
        />
      </View>
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { marginHorizontal: spacing.lg, marginTop: spacing.lg },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary50,
    justifyContent: "center",
    alignItems: "center",
  },
  name: { ...typography.headlineSmall, color: colors.textPrimary },
  meta: { ...typography.bodySmall, color: colors.textSecondary },
  sectionTitle: { ...typography.titleMedium, color: colors.textPrimary },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  availRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  availStatus: { ...typography.labelLarge, marginTop: spacing.xs },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  detailLabel: { ...typography.bodyMedium, color: colors.textSecondary },
  detailValue: { ...typography.bodyMedium, color: colors.textPrimary },
  editActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  photoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  photoInfo: {
    flex: 1,
  },
  thumbnail: {
    width: 80,
    height: 56,
    borderRadius: 6,
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
  },
  notUploaded: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary200,
    backgroundColor: colors.primary50,
  },
  uploadText: {
    ...typography.labelLarge,
    color: colors.primary600,
  },
  logoutSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing["2xl"],
  },
});
