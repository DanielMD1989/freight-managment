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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  useWalletBalance,
  useWalletTransactions,
} from "../../../src/hooks/useWallet";
import { Card } from "../../../src/components/Card";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { EmptyState } from "../../../src/components/EmptyState";
import { formatCurrency, formatDate } from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";

const TX_FILTERS = [
  "ALL",
  "COMMISSION",
  "PAYMENT",
  "REFUND",
  "ADJUSTMENT",
] as const;

function getTxIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "PAYMENT":
      return "arrow-down-circle";
    case "COMMISSION":
      return "arrow-up-circle";
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
        <Text style={styles.balanceAmount}>
          {formatCurrency(balance, currency)}
        </Text>
        <Text style={styles.balanceSub}>
          {balanceData?.recentTransactionsCount ?? 0} recent transactions
        </Text>
      </Card>

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
