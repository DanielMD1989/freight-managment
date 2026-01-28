import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../app.dart';
import '../../../core/api/api_client.dart';

/// Wallet account model
class WalletAccount {
  final String id;
  final String type;
  final double balance;
  final String currency;
  final DateTime? updatedAt;

  WalletAccount({
    required this.id,
    required this.type,
    required this.balance,
    required this.currency,
    this.updatedAt,
  });

  factory WalletAccount.fromJson(Map<String, dynamic> json) {
    return WalletAccount(
      id: json['id'] ?? '',
      type: json['type'] ?? 'WALLET',
      balance: (json['balance'] ?? 0).toDouble(),
      currency: json['currency'] ?? 'ETB',
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'])
          : null,
    );
  }
}

/// Wallet balance result
class WalletBalanceResult {
  final List<WalletAccount> wallets;
  final double totalBalance;
  final String currency;
  final int recentCommissionsCount;

  WalletBalanceResult({
    required this.wallets,
    required this.totalBalance,
    required this.currency,
    required this.recentCommissionsCount,
  });

  factory WalletBalanceResult.fromJson(Map<String, dynamic> json) {
    return WalletBalanceResult(
      wallets: (json['wallets'] as List? ?? [])
          .map((w) => WalletAccount.fromJson(w))
          .toList(),
      totalBalance: (json['totalBalance'] ?? 0).toDouble(),
      currency: json['currency'] ?? 'ETB',
      recentCommissionsCount: json['recentCommissionsCount'] ?? 0,
    );
  }
}

/// Transaction model
class WalletTransaction {
  final String id;
  final String type;
  final String? description;
  final String? reference;
  final String? loadId;
  final double amount;
  final DateTime createdAt;

  WalletTransaction({
    required this.id,
    required this.type,
    this.description,
    this.reference,
    this.loadId,
    required this.amount,
    required this.createdAt,
  });

  factory WalletTransaction.fromJson(Map<String, dynamic> json) {
    return WalletTransaction(
      id: json['id'] ?? '',
      type: json['type'] ?? 'PAYMENT',
      description: json['description'],
      reference: json['reference'],
      loadId: json['loadId'],
      amount: (json['amount'] ?? 0).toDouble(),
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }

  bool get isCredit => amount > 0;
  bool get isDebit => amount < 0;

  String get typeDisplay {
    switch (type.toUpperCase()) {
      case 'COMMISSION':
        return 'Commission';
      case 'PAYMENT':
        return 'Payment';
      case 'REFUND':
        return 'Refund';
      case 'ADJUSTMENT':
        return 'Adjustment';
      default:
        return type;
    }
  }

  IconData get typeIcon {
    switch (type.toUpperCase()) {
      case 'COMMISSION':
        return Icons.monetization_on;
      case 'PAYMENT':
        return Icons.payment;
      case 'REFUND':
        return Icons.replay;
      case 'ADJUSTMENT':
        return Icons.tune;
      default:
        return Icons.receipt;
    }
  }
}

/// Provider for wallet balance
final walletBalanceProvider =
    FutureProvider.autoDispose<WalletBalanceResult>((ref) async {
  final apiClient = ApiClient();
  try {
    final response = await apiClient.dio.get('/api/wallet/balance');
    if (response.statusCode == 200) {
      return WalletBalanceResult.fromJson(response.data);
    }
    throw Exception('Failed to load wallet balance');
  } catch (e) {
    throw Exception('Failed to load wallet: $e');
  }
});

/// Provider for transactions
final walletTransactionsProvider =
    FutureProvider.autoDispose<List<WalletTransaction>>((ref) async {
  final apiClient = ApiClient();
  try {
    final response = await apiClient.dio.get(
      '/api/wallet/transactions',
      queryParameters: {'limit': '50'},
    );
    if (response.statusCode == 200) {
      final transactions = (response.data['transactions'] as List? ?? [])
          .map((t) => WalletTransaction.fromJson(t))
          .toList();
      return transactions;
    }
    return [];
  } catch (e) {
    return [];
  }
});

/// Wallet Screen - View balance and transactions
class WalletScreen extends ConsumerWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final balanceAsync = ref.watch(walletBalanceProvider);
    final transactionsAsync = ref.watch(walletTransactionsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Wallet'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(walletBalanceProvider);
              ref.invalidate(walletTransactionsProvider);
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(walletBalanceProvider);
          ref.invalidate(walletTransactionsProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Balance Card
              balanceAsync.when(
                data: (balance) => _BalanceCard(balance: balance),
                loading: () => _BalanceCardSkeleton(),
                error: (error, _) => _ErrorCard(
                  message: 'Failed to load balance',
                  onRetry: () => ref.invalidate(walletBalanceProvider),
                ),
              ),

              const SizedBox(height: 24),

              // Quick Actions
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    Expanded(
                      child: _ActionButton(
                        icon: Icons.add,
                        label: 'Add Funds',
                        onTap: () => _showComingSoon(context),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _ActionButton(
                        icon: Icons.arrow_upward,
                        label: 'Withdraw',
                        onTap: () => _showComingSoon(context),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Transactions Section
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Recent Transactions',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        // View all transactions
                      },
                      child: const Text('View All'),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 8),

              // Transactions List
              transactionsAsync.when(
                data: (transactions) {
                  if (transactions.isEmpty) {
                    return _EmptyTransactions();
                  }
                  return ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: transactions.length,
                    itemBuilder: (context, index) {
                      return _TransactionItem(
                        transaction: transactions[index],
                      );
                    },
                  );
                },
                loading: () => _TransactionsSkeleton(),
                error: (_, __) => _EmptyTransactions(),
              ),

              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  void _showComingSoon(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('This feature is coming soon!'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

/// Balance card widget
class _BalanceCard extends StatelessWidget {
  final WalletBalanceResult balance;

  const _BalanceCard({required this.balance});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.primary, AppColors.primaryDark],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.3),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.account_balance_wallet,
                  color: Colors.white70, size: 20),
              const SizedBox(width: 8),
              const Text(
                'Current Balance',
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const Spacer(),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  balance.currency,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            _formatCurrency(balance.totalBalance, balance.currency),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 36,
              fontWeight: FontWeight.bold,
              letterSpacing: -1,
            ),
          ),
          const SizedBox(height: 16),
          if (balance.recentCommissionsCount > 0)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.trending_up, color: Colors.white, size: 16),
                  const SizedBox(width: 8),
                  Text(
                    '${balance.recentCommissionsCount} transactions this month',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  String _formatCurrency(double amount, String currency) {
    final formatter = NumberFormat.currency(
      symbol: currency == 'ETB' ? 'ETB ' : '\$',
      decimalDigits: 2,
    );
    return formatter.format(amount);
  }
}

/// Balance card skeleton
class _BalanceCardSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.slate200,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 120,
            height: 16,
            decoration: BoxDecoration(
              color: AppColors.slate300,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          const SizedBox(height: 16),
          Container(
            width: 200,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.slate300,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
        ],
      ),
    );
  }
}

/// Error card
class _ErrorCard extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorCard({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          const Icon(Icons.error_outline, color: AppColors.error, size: 48),
          const SizedBox(height: 16),
          Text(
            message,
            style: const TextStyle(color: AppColors.error),
          ),
          const SizedBox(height: 16),
          TextButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

/// Action button
class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.primary100,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: AppColors.primary),
              ),
              const SizedBox(height: 8),
              Text(
                label,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Transaction item
class _TransactionItem extends StatelessWidget {
  final WalletTransaction transaction;

  const _TransactionItem({required this.transaction});

  @override
  Widget build(BuildContext context) {
    final isCredit = transaction.isCredit;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: isCredit
                ? AppColors.success.withValues(alpha: 0.1)
                : AppColors.error.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(
            transaction.typeIcon,
            color: isCredit ? AppColors.success : AppColors.error,
            size: 20,
          ),
        ),
        title: Text(
          transaction.typeDisplay,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text(
          transaction.description ?? DateFormat('MMM d, yyyy').format(transaction.createdAt),
          style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
        ),
        trailing: Text(
          '${isCredit ? '+' : ''}${_formatCurrency(transaction.amount)}',
          style: TextStyle(
            color: isCredit ? AppColors.success : AppColors.error,
            fontWeight: FontWeight.bold,
            fontSize: 16,
          ),
        ),
      ),
    );
  }

  String _formatCurrency(double amount) {
    final formatter = NumberFormat.currency(symbol: 'ETB ', decimalDigits: 2);
    return formatter.format(amount.abs());
  }
}

/// Empty transactions
class _EmptyTransactions extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: AppColors.slate100,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Icon(Icons.receipt_long_outlined, size: 48, color: Colors.grey[400]),
          const SizedBox(height: 16),
          const Text(
            'No transactions yet',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Your transaction history will appear here',
            style: TextStyle(color: Colors.grey[600]),
          ),
        ],
      ),
    );
  }
}

/// Transactions skeleton
class _TransactionsSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        3,
        (index) => Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.slate100,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.slate200,
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 100,
                      height: 14,
                      decoration: BoxDecoration(
                        color: AppColors.slate200,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      width: 150,
                      height: 12,
                      decoration: BoxDecoration(
                        color: AppColors.slate200,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                width: 80,
                height: 20,
                decoration: BoxDecoration(
                  color: AppColors.slate200,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
