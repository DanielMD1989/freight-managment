/**
 * Wallet Screen
 * Shows balance, quick actions, and transaction history
 */
import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import apiClient from "../../src/api/client";
import { Card } from "../../src/components/Card";
import { LoadingSpinner } from "../../src/components/LoadingSpinner";
import { EmptyState } from "../../src/components/EmptyState";
import { formatCurrency } from "../../src/utils/format";
import { colors } from "../../src/theme/colors";
import { spacing, borderRadius } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

interface WalletBalance {
  balance: number;
  currency: string;
  pendingCredits: number;
  pendingDebits: number;
}

interface WalletTransaction {
  id: string;
  type: "COMMISSION" | "PAYMENT" | "REFUND" | "ADJUSTMENT";
  amount: number;
  description: string;
  createdAt: string;
}

function useWalletBalance() {
  return useQuery<WalletBalance>({
    queryKey: ["wallet", "balance"],
    queryFn: async () => {
      const res = await apiClient.get("/api/wallet/balance");
      return res.data;
    },
  });
}

function useWalletTransactions() {
  return useQuery<WalletTransaction[]>({
    queryKey: ["wallet", "transactions"],
    queryFn: async () => {
      const res = await apiClient.get("/api/wallet/transactions?limit=50");
      return res.data.transactions ?? res.data ?? [];
    },
  });
}

export default function WalletScreen() {
  const {
    data: balance,
    isLoading: balanceLoading,
    refetch: refetchBalance,
    isRefetching: refetchingBalance,
  } = useWalletBalance();
  const {
    data: transactions,
    isLoading: txLoading,
    refetch: refetchTx,
    isRefetching: refetchingTx,
  } = useWalletTransactions();

  const isRefreshing = refetchingBalance || refetchingTx;
  const handleRefresh = () => {
    refetchBalance();
    refetchTx();
  };

  const handleComingSoon = () =>
    Alert.alert("Coming Soon", "This feature is under development.");

  const txIconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
    COMMISSION: "cash-outline",
    PAYMENT: "card-outline",
    REFUND: "refresh-outline",
    ADJUSTMENT: "options-outline",
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Balance card */}
      <View style={styles.balanceCard}>
        {balanceLoading ? (
          <LoadingSpinner message="Loading balance..." />
        ) : (
          <>
            <Text style={styles.balanceLabel}>Total Balance</Text>
            <Text style={styles.balanceAmount}>
              {formatCurrency(balance?.balance ?? 0)}
            </Text>
            <Text style={styles.balanceCurrency}>
              {balance?.currency ?? "ETB"}
            </Text>

            {(balance?.pendingCredits ?? 0) > 0 && (
              <View style={styles.pendingRow}>
                <Ionicons
                  name="arrow-down-outline"
                  size={14}
                  color={colors.success}
                />
                <Text style={styles.pendingText}>
                  +{formatCurrency(balance?.pendingCredits ?? 0)} pending
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Quick actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleComingSoon}>
          <View style={styles.actionIcon}>
            <Ionicons
              name="add-circle-outline"
              size={24}
              color={colors.primary500}
            />
          </View>
          <Text style={styles.actionLabel}>Add Funds</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleComingSoon}>
          <View style={styles.actionIcon}>
            <Ionicons
              name="arrow-up-circle-outline"
              size={24}
              color={colors.accent500}
            />
          </View>
          <Text style={styles.actionLabel}>Withdraw</Text>
        </TouchableOpacity>
      </View>

      {/* Transactions */}
      <View style={styles.txSection}>
        <Text style={styles.txTitle}>Recent Transactions</Text>

        {txLoading ? (
          <LoadingSpinner />
        ) : !transactions || transactions.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="No transactions"
            message="Your transaction history will appear here"
          />
        ) : (
          transactions.map((tx) => (
            <Card key={tx.id} style={styles.txCard} padding="md">
              <View style={styles.txRow}>
                <View style={styles.txIconContainer}>
                  <Ionicons
                    name={txIconMap[tx.type] ?? "receipt-outline"}
                    size={20}
                    color={tx.amount >= 0 ? colors.success : colors.error}
                  />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txType}>{tx.type}</Text>
                  <Text style={styles.txDesc} numberOfLines={1}>
                    {tx.description}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.txAmount,
                    { color: tx.amount >= 0 ? colors.success : colors.error },
                  ]}
                >
                  {tx.amount >= 0 ? "+" : ""}
                  {formatCurrency(tx.amount)}
                </Text>
              </View>
            </Card>
          ))
        )}
      </View>

      <View style={{ height: spacing["3xl"] }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  balanceCard: {
    margin: spacing.lg,
    padding: spacing["2xl"],
    borderRadius: borderRadius["2xl"],
    backgroundColor: colors.primary600,
    alignItems: "center",
  },
  balanceLabel: {
    ...typography.bodyMedium,
    color: colors.primary100,
  },
  balanceAmount: {
    ...typography.displayLarge,
    color: colors.white,
    marginTop: spacing.xs,
  },
  balanceCurrency: {
    ...typography.bodySmall,
    color: colors.primary200,
    marginTop: spacing.xs,
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: borderRadius.full,
  },
  pendingText: {
    ...typography.bodySmall,
    color: colors.success,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing["2xl"],
    marginBottom: spacing.lg,
  },
  actionBtn: { alignItems: "center" },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xs,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  actionLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  txSection: {
    paddingHorizontal: spacing.lg,
  },
  txTitle: {
    ...typography.titleSmall,
    color: colors.textTertiary,
    textTransform: "uppercase",
    marginBottom: spacing.md,
  },
  txCard: { marginBottom: spacing.sm },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  txIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.slate50,
    justifyContent: "center",
    alignItems: "center",
  },
  txInfo: { flex: 1 },
  txType: { ...typography.titleSmall, color: colors.textPrimary },
  txDesc: { ...typography.bodySmall, color: colors.textTertiary },
  txAmount: { ...typography.titleSmall, fontWeight: "600" },
});
