import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../app.dart';
import '../../../core/api/api_client.dart';
import '../../../core/providers/auth_provider.dart';

/// Verification step model
class VerificationStep {
  final String id;
  final String label;
  final String status; // 'completed', 'pending', 'not_started'
  final String? description;

  VerificationStep({
    required this.id,
    required this.label,
    required this.status,
    this.description,
  });

  factory VerificationStep.fromJson(Map<String, dynamic> json) {
    return VerificationStep(
      id: json['id'] ?? '',
      label: json['label'] ?? '',
      status: json['status'] ?? 'not_started',
      description: json['description'],
    );
  }

  bool get isCompleted => status == 'completed';
  bool get isPending => status == 'pending';
  bool get isNotStarted => status == 'not_started';
}

/// Verification status data
class VerificationStatus {
  final String status;
  final String userRole;
  final bool canAccessMarketplace;
  final List<VerificationStep> steps;
  final int progressPercent;
  final bool documentsUploaded;
  final int documentCount;
  final String? estimatedReviewTime;
  final String? nextActionType;
  final String? nextActionLabel;
  final String? nextActionDescription;

  VerificationStatus({
    required this.status,
    required this.userRole,
    required this.canAccessMarketplace,
    required this.steps,
    required this.progressPercent,
    required this.documentsUploaded,
    required this.documentCount,
    this.estimatedReviewTime,
    this.nextActionType,
    this.nextActionLabel,
    this.nextActionDescription,
  });

  factory VerificationStatus.fromJson(Map<String, dynamic> json) {
    final verification = json['verification'] ?? {};
    final nextAction = json['nextAction'];

    return VerificationStatus(
      status: json['status'] ?? 'REGISTERED',
      userRole: json['userRole'] ?? '',
      canAccessMarketplace: json['canAccessMarketplace'] ?? false,
      steps: (verification['steps'] as List? ?? [])
          .map((s) => VerificationStep.fromJson(s))
          .toList(),
      progressPercent: verification['progressPercent'] ?? 0,
      documentsUploaded: verification['documentsUploaded'] ?? false,
      documentCount: verification['documentCount'] ?? 0,
      estimatedReviewTime: json['estimatedReviewTime'],
      nextActionType: nextAction?['type'],
      nextActionLabel: nextAction?['label'],
      nextActionDescription: nextAction?['description'],
    );
  }
}

/// Provider for verification status
final verificationStatusProvider =
    FutureProvider.autoDispose<VerificationStatus>((ref) async {
  final apiClient = ApiClient();
  final response = await apiClient.dio.get('/api/user/verification-status');
  return VerificationStatus.fromJson(response.data);
});

/// Pending Verification Screen
class PendingVerificationScreen extends ConsumerStatefulWidget {
  const PendingVerificationScreen({super.key});

  @override
  ConsumerState<PendingVerificationScreen> createState() =>
      _PendingVerificationScreenState();
}

class _PendingVerificationScreenState
    extends ConsumerState<PendingVerificationScreen> {
  @override
  Widget build(BuildContext context) {
    final statusAsync = ref.watch(verificationStatusProvider);
    final authState = ref.watch(authStateProvider);

    return Scaffold(
      body: SafeArea(
        child: statusAsync.when(
          data: (status) {
            // If user became ACTIVE, redirect to their portal
            if (status.canAccessMarketplace) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                final role = status.userRole;
                if (role == 'CARRIER') {
                  context.go('/carrier');
                } else if (role == 'SHIPPER') {
                  context.go('/shipper');
                }
              });
            }

            return RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(verificationStatusProvider);
              },
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SizedBox(height: 20),

                      // Header
                      _buildHeader(authState.user?.email ?? ''),

                      const SizedBox(height: 24),

                      // Progress Card
                      _buildProgressCard(status),

                      const SizedBox(height: 24),

                      // Verification Steps
                      _buildStepsCard(status.steps),

                      const SizedBox(height: 24),

                      // Next Action
                      if (status.nextActionType != null)
                        _buildNextActionCard(status),

                      const SizedBox(height: 24),

                      // Estimated Time
                      if (status.estimatedReviewTime != null)
                        _buildEstimatedTimeCard(status.estimatedReviewTime!),

                      const SizedBox(height: 32),

                      // Actions
                      _buildActions(),

                      const SizedBox(height: 24),

                      // Pull to refresh hint
                      Center(
                        child: Text(
                          'Pull down to refresh',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey[500],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
          loading: () => const Center(
            child: CircularProgressIndicator(),
          ),
          error: (error, stack) => Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 48, color: Colors.red),
                const SizedBox(height: 16),
                Text('Error loading status: $error'),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () => ref.invalidate(verificationStatusProvider),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(String email) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primary, AppColors.primaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(
              Icons.verified_user,
              color: Colors.white,
              size: 28,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Account Verification',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  email,
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.white.withValues(alpha: 0.8),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProgressCard(VerificationStatus status) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Progress',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  '${status.progressPercent}%',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: status.progressPercent / 100,
                minHeight: 8,
                backgroundColor: AppColors.slate100,
                valueColor:
                    const AlwaysStoppedAnimation<Color>(AppColors.primary),
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.warning.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: AppColors.warning,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    status.status == 'REGISTERED'
                        ? 'Registration Complete'
                        : 'Under Review',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.warning,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStepsCard(List<VerificationStep> steps) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Verification Steps',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 16),
            ...steps.map((step) => _buildStepItem(step)),
          ],
        ),
      ),
    );
  }

  Widget _buildStepItem(VerificationStep step) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildStepIcon(step.status),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      step.label,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: step.isCompleted
                            ? AppColors.success
                            : step.isPending
                                ? AppColors.warning
                                : AppColors.textSecondary,
                      ),
                    ),
                    if (step.isPending) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.warning.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Text(
                          'In Progress',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppColors.warning,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                if (step.description != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    step.description!,
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStepIcon(String status) {
    if (status == 'completed') {
      return Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: AppColors.success.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: const Icon(
          Icons.check,
          size: 20,
          color: AppColors.success,
        ),
      );
    } else if (status == 'pending') {
      return Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: AppColors.warning.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: const SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            valueColor: AlwaysStoppedAnimation<Color>(AppColors.warning),
          ),
        ),
      );
    } else {
      return Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: AppColors.slate100,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Center(
          child: Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: AppColors.slate300,
              borderRadius: BorderRadius.circular(5),
            ),
          ),
        ),
      );
    }
  }

  Widget _buildNextActionCard(VerificationStatus status) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.primary50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            status.nextActionLabel ?? 'Next Step',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: AppColors.primary700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            status.nextActionDescription ?? '',
            style: const TextStyle(
              fontSize: 14,
              color: AppColors.primary600,
            ),
          ),
          if (status.nextActionType == 'upload_documents') ...[
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: () {
                // Navigate to document upload screen
                context.push('/profile');
              },
              icon: const Icon(Icons.cloud_upload),
              label: const Text('Upload Documents'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildEstimatedTimeCard(String estimatedTime) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.slate50,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(Icons.schedule, color: Colors.grey[600], size: 20),
          const SizedBox(width: 12),
          Text(
            'Estimated review time: ',
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[600],
            ),
          ),
          Text(
            estimatedTime,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActions() {
    return Column(
      children: [
        OutlinedButton.icon(
          onPressed: () async {
            final uri = Uri.parse('mailto:support@freightflow.app');
            if (await canLaunchUrl(uri)) {
              await launchUrl(uri);
            }
          },
          icon: const Icon(Icons.email),
          label: const Text('Contact Support'),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(double.infinity, 50),
          ),
        ),
        const SizedBox(height: 12),
        TextButton.icon(
          onPressed: () async {
            await ref.read(authStateProvider.notifier).logout();
            if (mounted) {
              context.go('/login');
            }
          },
          icon: const Icon(Icons.logout),
          label: const Text('Log Out'),
          style: TextButton.styleFrom(
            foregroundColor: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }
}
