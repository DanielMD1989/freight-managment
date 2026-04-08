/**
 * Wallet Screen - Balance overview and transaction history
 */
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  useWalletBalance,
  useWalletTransactions,
  useRequestDeposit,
} from "../../../src/hooks/useWallet";
import { borderRadius } from "../../../src/theme/spacing";
import { Card } from "../../../src/components/Card";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { EmptyState } from "../../../src/components/EmptyState";
import { formatCurrency, formatDate } from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";

const TX_FILTERS = [
  "ALL",
  "DEPOSIT",
  "WITHDRAWAL",
  "COMMISSION",
  "SETTLEMENT",
  "REFUND",
] as const;

function getTxIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "DEPOSIT":
      return "arrow-down-circle";
    case "WITHDRAWAL":
      return "arrow-up-circle";
    case "COMMISSION":
      return "trending-up-outline";
    case "SETTLEMENT":
      return "cash-outline";
    case "REFUND":
      return "refresh-circle";
    default:
      return "swap-horizontal-outline";
  }
}

function getTxColor(amount: number): string {
  return amount >= 0 ? colors.success : colors.error;
}

export default function WalletScreen() {
  useTranslation();
  const [txFilter, setTxFilter] = useState<string>("ALL");

  // Blueprint §8 self-service deposit (mirror of web shipper eb68304)
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState<
    "BANK_TRANSFER_SLIP" | "TELEBIRR" | "MPESA"
  >("BANK_TRANSFER_SLIP");
  const [depositSlipUrl, setDepositSlipUrl] = useState("");
  const [depositReference, setDepositReference] = useState("");
  const [depositNotes, setDepositNotes] = useState("");
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositSuccess, setDepositSuccess] = useState<string | null>(null);
  const requestDeposit = useRequestDeposit();

  const resetDepositForm = () => {
    setDepositAmount("");
    setDepositSlipUrl("");
    setDepositReference("");
    setDepositNotes("");
    setDepositMethod("BANK_TRANSFER_SLIP");
    setDepositError(null);
    setDepositSuccess(null);
  };

  const submitDeposit = async () => {
    setDepositError(null);
    setDepositSuccess(null);
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      setDepositError("Please enter a valid amount");
      return;
    }
    if (depositMethod === "BANK_TRANSFER_SLIP" && !depositSlipUrl.trim()) {
      setDepositError("Bank transfer requires a slip file URL");
      return;
    }
    if (
      (depositMethod === "TELEBIRR" || depositMethod === "MPESA") &&
      !depositReference.trim()
    ) {
      setDepositError(
        "Telebirr/M-Pesa deposits require a transaction reference"
      );
      return;
    }
    try {
      await requestDeposit.mutateAsync({
        amount,
        paymentMethod: depositMethod,
        slipFileUrl:
          depositMethod === "BANK_TRANSFER_SLIP" ? depositSlipUrl : undefined,
        externalReference:
          depositMethod !== "BANK_TRANSFER_SLIP" ? depositReference : undefined,
        notes: depositNotes || undefined,
      });
      setDepositSuccess(
        "Deposit request submitted. Admin will review within 1-2 business days."
      );
      setDepositAmount("");
      setDepositSlipUrl("");
      setDepositReference("");
      setDepositNotes("");
    } catch (err) {
      setDepositError(
        err instanceof Error ? err.message : "Failed to submit deposit request"
      );
    }
  };

  const {
    data: balanceData,
    isLoading: balLoading,
    refetch: refetchBal,
    isRefetching: balRefetching,
  } = useWalletBalance();

  const filterParam = txFilter === "ALL" ? undefined : txFilter;
  const {
    data: txData,
    isLoading: txLoading,
    refetch: refetchTx,
    isRefetching: txRefetching,
  } = useWalletTransactions({ type: filterParam, limit: 50 });

  const isLoading = balLoading && !balanceData;
  const isRefetching = balRefetching || txRefetching;
  const refetch = () => {
    refetchBal();
    refetchTx();
  };

  if (isLoading) return <LoadingSpinner fullScreen />;

  const balance = balanceData?.totalBalance ?? 0;
  const currency = balanceData?.currency ?? "ETB";
  const transactions = txData?.transactions ?? [];

  // Per-category totals (added in B1 — single source of truth from journal)
  const totalDeposited = balanceData?.totalDeposited ?? 0;
  const totalRefunded = balanceData?.totalRefunded ?? 0;
  const serviceFeesPaid = balanceData?.serviceFeesPaid ?? 0;
  const totalWithdrawn = balanceData?.totalWithdrawn ?? 0;
  const isLedgerInSync = balanceData?.isLedgerInSync ?? true;
  const ledgerDrift = balanceData?.ledgerDrift ?? 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      {/* Balance Card */}
      <Card style={styles.balanceCard} padding="2xl">
        <Text style={styles.balanceLabel}>Current Balance</Text>
        <Text testID="wallet-current-balance" style={styles.balanceAmount}>
          {formatCurrency(balance, currency)}
        </Text>
        <Text style={styles.balanceSub}>
          {balanceData?.recentTransactionsCount ?? 0} recent transactions
        </Text>
        <TouchableOpacity
          style={{
            marginTop: spacing.md,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.white,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.lg,
            borderRadius: borderRadius.md,
            gap: 6,
          }}
          onPress={() => {
            resetDepositForm();
            setShowDepositModal(true);
          }}
          accessibilityLabel="Deposit Funds"
          testID="wallet-deposit-button"
        >
          <Ionicons name="add-circle" size={18} color={colors.primary500} />
          <Text
            style={{
              ...typography.bodyMedium,
              color: colors.primary500,
              fontWeight: "600",
            }}
          >
            Deposit Funds
          </Text>
        </TouchableOpacity>
      </Card>

      {/* Ledger integrity warning (only shown if drift detected) */}
      {!isLedgerInSync && (
        <Card style={styles.driftWarning} padding="md">
          <View style={styles.driftRow}>
            <Ionicons name="warning-outline" size={20} color={colors.warning} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={styles.driftTitle}>
                Wallet ledger drift detected
              </Text>
              <Text style={styles.driftBody}>
                Stored balance differs from journal sum by{" "}
                {formatCurrency(Math.abs(ledgerDrift), currency)}. Please
                contact support — your transactions will reconcile.
              </Text>
            </View>
          </View>
        </Card>
      )}

      {/* Per-category Summary Cards (parity with web wallet page) */}
      <View style={styles.summaryGrid}>
        <Card style={styles.summaryCard} padding="md">
          <Ionicons name="arrow-down-circle" size={22} color={colors.success} />
          <Text style={styles.summaryLabel}>Total Deposited</Text>
          <Text style={styles.summaryAmount}>
            {formatCurrency(totalDeposited, currency)}
          </Text>
        </Card>
        <Card style={styles.summaryCard} padding="md">
          <Ionicons name="card-outline" size={22} color={colors.error} />
          <Text style={styles.summaryLabel}>Service Fees Paid</Text>
          <Text style={styles.summaryAmount}>
            {formatCurrency(serviceFeesPaid, currency)}
          </Text>
        </Card>
        <Card style={styles.summaryCard} padding="md">
          <Ionicons name="refresh-circle" size={22} color={colors.primary500} />
          <Text style={styles.summaryLabel}>Refunds Received</Text>
          <Text style={styles.summaryAmount}>
            {formatCurrency(totalRefunded, currency)}
          </Text>
        </Card>
        <Card style={styles.summaryCard} padding="md">
          <Ionicons name="arrow-up-circle" size={22} color={colors.warning} />
          <Text style={styles.summaryLabel}>Withdrawn</Text>
          <Text style={styles.summaryAmount}>
            {formatCurrency(totalWithdrawn, currency)}
          </Text>
        </Card>
      </View>

      {/* Wallet Accounts */}
      {balanceData?.wallets && balanceData.wallets.length > 0 && (
        <View style={styles.walletsRow}>
          {balanceData.wallets.map((w) => (
            <Card key={w.id} style={styles.walletMini} padding="lg">
              <Ionicons
                name="wallet-outline"
                size={22}
                color={colors.primary500}
              />
              <Text style={styles.walletMiniLabel}>
                {w.type.replace(/_/g, " ")}
              </Text>
              <Text style={styles.walletMiniAmount}>
                {formatCurrency(w.balance, w.currency)}
              </Text>
            </Card>
          ))}
        </View>
      )}

      {/* Transaction filter chips */}
      <Text style={styles.sectionTitle}>Transactions</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}
      >
        {TX_FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, txFilter === f && styles.chipActive]}
            onPress={() => setTxFilter(f)}
          >
            <Text
              style={[styles.chipText, txFilter === f && styles.chipTextActive]}
            >
              {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Transaction List */}
      {/* Hidden JSON for stable test reads on Expo web export */}
      <Text
        testID="wallet-transactions-json"
        style={{ position: "absolute", left: -9999, opacity: 0 }}
      >
        {JSON.stringify(
          transactions.map((t: any) => ({
            id: t.id,
            type: t.type,
            amount: t.amount,
            isDebit: t.isDebit,
          }))
        )}
      </Text>
      <Text
        testID="wallet-transaction-count"
        style={{ position: "absolute", left: -9999, opacity: 0 }}
      >
        {transactions.length}
      </Text>

      {txLoading && !txData ? (
        <LoadingSpinner />
      ) : transactions.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title="No Transactions"
          message="Your wallet transactions will appear here"
        />
      ) : (
        transactions.map((tx) => (
          <View key={tx.id} style={styles.txWrapper}>
            <Card>
              <View style={styles.txRow}>
                <Ionicons
                  name={getTxIcon(tx.type)}
                  size={28}
                  color={getTxColor(tx.amount)}
                />
                <View style={styles.txInfo}>
                  <Text style={styles.txDesc} numberOfLines={1}>
                    {tx.description}
                  </Text>
                  <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
                  {tx.reference ? (
                    <Text style={styles.txRef} numberOfLines={1}>
                      Ref: {tx.reference}
                    </Text>
                  ) : null}
                </View>
                <Text
                  style={[styles.txAmount, { color: getTxColor(tx.amount) }]}
                >
                  {tx.amount >= 0 ? "+" : ""}
                  {formatCurrency(tx.amount)}
                </Text>
              </View>
            </Card>
          </View>
        ))
      )}

      {txData?.pagination?.hasMore && (
        <Text style={styles.hasMore}>
          Showing {transactions.length} of {txData.pagination.totalCount}
        </Text>
      )}

      <View style={{ height: spacing["3xl"] }} />

      {/* Blueprint §8 self-service deposit form modal */}
      <Modal
        visible={showDepositModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDepositModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.55)",
            justifyContent: "center",
            padding: spacing.lg,
          }}
        >
          <View
            style={{
              backgroundColor: colors.white,
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              maxHeight: "90%",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: spacing.sm,
              }}
            >
              <Text
                style={{ ...typography.titleLarge, color: colors.textPrimary }}
              >
                Deposit Funds
              </Text>
              <TouchableOpacity
                onPress={() => setShowDepositModal(false)}
                disabled={requestDeposit.isPending}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text
              style={{
                ...typography.labelLarge,
                color: colors.textSecondary,
                marginBottom: spacing.md,
              }}
            >
              Submit a deposit request. Admin verifies and credits within 1–2
              business days.
            </Text>

            <ScrollView
              style={{ maxHeight: 460 }}
              keyboardShouldPersistTaps="handled"
            >
              {depositSuccess ? (
                <View>
                  <View
                    style={{
                      backgroundColor: "#D1FAE5",
                      borderRadius: borderRadius.md,
                      padding: spacing.md,
                      marginBottom: spacing.md,
                    }}
                  >
                    <Text
                      style={{
                        ...typography.bodyMedium,
                        color: "#047857",
                      }}
                    >
                      {depositSuccess}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setShowDepositModal(false);
                      setDepositSuccess(null);
                    }}
                    style={{
                      backgroundColor: colors.primary500,
                      borderRadius: borderRadius.md,
                      paddingVertical: spacing.sm,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        ...typography.bodyMedium,
                        color: colors.white,
                        fontWeight: "600",
                      }}
                    >
                      Close
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  {depositError && (
                    <View
                      style={{
                        backgroundColor: "#FEE2E2",
                        borderRadius: borderRadius.md,
                        padding: spacing.sm,
                        marginBottom: spacing.md,
                      }}
                    >
                      <Text
                        style={{
                          ...typography.labelLarge,
                          color: "#B91C1C",
                        }}
                      >
                        {depositError}
                      </Text>
                    </View>
                  )}

                  <Text
                    style={{
                      ...typography.labelLarge,
                      color: colors.textSecondary,
                      marginBottom: 4,
                    }}
                  >
                    Amount (ETB) *
                  </Text>
                  <TextInput
                    value={depositAmount}
                    onChangeText={setDepositAmount}
                    placeholder="e.g. 5000"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                    accessibilityLabel="Deposit amount"
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: borderRadius.md,
                      padding: spacing.sm,
                      color: colors.textPrimary,
                      marginBottom: spacing.md,
                    }}
                  />

                  <Text
                    style={{
                      ...typography.labelLarge,
                      color: colors.textSecondary,
                      marginBottom: 4,
                    }}
                  >
                    Payment Method *
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: spacing.xs,
                      marginBottom: spacing.md,
                    }}
                  >
                    {(
                      [
                        ["BANK_TRANSFER_SLIP", "Bank Slip"],
                        ["TELEBIRR", "Telebirr"],
                        ["MPESA", "M-Pesa"],
                      ] as const
                    ).map(([key, label]) => (
                      <TouchableOpacity
                        key={key}
                        onPress={() => setDepositMethod(key)}
                        style={{
                          flex: 1,
                          paddingVertical: spacing.sm,
                          borderRadius: borderRadius.md,
                          borderWidth: 1,
                          borderColor:
                            depositMethod === key
                              ? colors.primary500
                              : colors.border,
                          backgroundColor:
                            depositMethod === key
                              ? colors.primary50
                              : colors.white,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            ...typography.labelLarge,
                            color:
                              depositMethod === key
                                ? colors.primary700
                                : colors.textSecondary,
                          }}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {depositMethod === "BANK_TRANSFER_SLIP" ? (
                    <View>
                      <Text
                        style={{
                          ...typography.labelLarge,
                          color: colors.textSecondary,
                          marginBottom: 4,
                        }}
                      >
                        Slip File URL *
                      </Text>
                      <TextInput
                        value={depositSlipUrl}
                        onChangeText={setDepositSlipUrl}
                        placeholder="https://… link to your slip"
                        placeholderTextColor={colors.textTertiary}
                        autoCapitalize="none"
                        accessibilityLabel="Slip file URL"
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: borderRadius.md,
                          padding: spacing.sm,
                          color: colors.textPrimary,
                          marginBottom: spacing.md,
                        }}
                      />
                    </View>
                  ) : (
                    <View>
                      <Text
                        style={{
                          ...typography.labelLarge,
                          color: colors.textSecondary,
                          marginBottom: 4,
                        }}
                      >
                        Transaction Reference *
                      </Text>
                      <TextInput
                        value={depositReference}
                        onChangeText={setDepositReference}
                        placeholder="e.g. CT123456789"
                        placeholderTextColor={colors.textTertiary}
                        accessibilityLabel="Transaction reference"
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: borderRadius.md,
                          padding: spacing.sm,
                          color: colors.textPrimary,
                          marginBottom: spacing.md,
                        }}
                      />
                    </View>
                  )}

                  <Text
                    style={{
                      ...typography.labelLarge,
                      color: colors.textSecondary,
                      marginBottom: 4,
                    }}
                  >
                    Notes (optional)
                  </Text>
                  <TextInput
                    value={depositNotes}
                    onChangeText={setDepositNotes}
                    placeholder="Anything Admin should know"
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    accessibilityLabel="Notes"
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: borderRadius.md,
                      padding: spacing.sm,
                      color: colors.textPrimary,
                      marginBottom: spacing.md,
                      minHeight: 60,
                      textAlignVertical: "top",
                    }}
                  />

                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "flex-end",
                      gap: spacing.sm,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => setShowDepositModal(false)}
                      disabled={requestDeposit.isPending}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: borderRadius.md,
                        paddingVertical: spacing.sm,
                        paddingHorizontal: spacing.lg,
                      }}
                    >
                      <Text
                        style={{
                          ...typography.bodyMedium,
                          color: colors.textSecondary,
                        }}
                      >
                        Cancel
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={submitDeposit}
                      disabled={requestDeposit.isPending}
                      style={{
                        backgroundColor: colors.primary500,
                        borderRadius: borderRadius.md,
                        paddingVertical: spacing.sm,
                        paddingHorizontal: spacing.lg,
                        minWidth: 120,
                        alignItems: "center",
                        opacity: requestDeposit.isPending ? 0.5 : 1,
                      }}
                    >
                      {requestDeposit.isPending ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text
                          style={{
                            ...typography.bodyMedium,
                            color: colors.white,
                            fontWeight: "600",
                          }}
                        >
                          Submit Request
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  balanceCard: {
    marginHorizontal: spacing["2xl"],
    marginTop: spacing["2xl"],
    alignItems: "center",
    backgroundColor: colors.primary600,
  },
  balanceLabel: {
    ...typography.labelMedium,
    color: colors.primary100,
  },
  balanceAmount: {
    ...typography.displayLarge,
    color: colors.white,
    marginTop: spacing.xs,
  },
  balanceSub: {
    ...typography.bodySmall,
    color: colors.primary200,
    marginTop: spacing.xs,
  },
  driftWarning: {
    marginHorizontal: spacing["2xl"],
    marginTop: spacing.lg,
    backgroundColor: colors.warningLight,
    borderColor: colors.warning,
    borderWidth: 1,
  },
  driftRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  driftTitle: {
    ...typography.titleSmall,
    color: colors.warningDark,
  },
  driftBody: {
    ...typography.bodySmall,
    color: colors.warningDark,
    marginTop: 2,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginHorizontal: spacing["2xl"],
    marginTop: spacing.lg,
  },
  summaryCard: {
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 140,
  },
  summaryLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  summaryAmount: {
    ...typography.titleSmall,
    color: colors.textPrimary,
    marginTop: 2,
  },
  walletsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginHorizontal: spacing["2xl"],
    marginTop: spacing.lg,
  },
  walletMini: {
    flex: 1,
    alignItems: "center",
  },
  walletMiniLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  walletMiniAmount: {
    ...typography.titleSmall,
    color: colors.textPrimary,
    marginTop: 2,
  },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    paddingHorizontal: spacing["2xl"],
    marginTop: spacing["2xl"],
    marginBottom: spacing.sm,
  },
  filterRow: { marginBottom: spacing.sm },
  filterContent: {
    paddingHorizontal: spacing["2xl"],
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    backgroundColor: colors.slate100,
    marginRight: spacing.sm,
  },
  chipActive: { backgroundColor: colors.primary600 },
  chipText: { ...typography.labelSmall, color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  txWrapper: {
    paddingHorizontal: spacing["2xl"],
    marginTop: spacing.sm,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  txInfo: { flex: 1 },
  txDesc: {
    ...typography.titleSmall,
    color: colors.textPrimary,
  },
  txDate: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: 1,
  },
  txRef: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    marginTop: 1,
  },
  txAmount: {
    ...typography.titleMedium,
    textAlign: "right",
  },
  hasMore: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: "center",
    marginTop: spacing.lg,
  },
});
