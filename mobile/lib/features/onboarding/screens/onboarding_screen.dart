import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../app.dart';

/// Onboarding data model
class OnboardingPage {
  final String title;
  final String description;
  final IconData icon;
  final Color iconBgColor;
  final Color iconColor;
  final List<String> features;

  const OnboardingPage({
    required this.title,
    required this.description,
    required this.icon,
    required this.iconBgColor,
    required this.iconColor,
    this.features = const [],
  });
}

/// Onboarding pages content
const List<OnboardingPage> onboardingPages = [
  OnboardingPage(
    title: "Welcome to FreightFlow",
    description: "Ethiopia's leading freight platform connecting shippers with verified carriers across the nation.",
    icon: Icons.local_shipping_rounded,
    iconBgColor: AppColors.primary100,
    iconColor: AppColors.primary600,
    features: [
      "Post loads or find cargo",
      "Verified carriers & shippers",
      "Nationwide coverage",
    ],
  ),
  OnboardingPage(
    title: "Real-Time GPS Tracking",
    description: "Track every shipment from pickup to delivery with live GPS updates and status notifications.",
    icon: Icons.location_on_rounded,
    iconBgColor: AppColors.accent100,
    iconColor: AppColors.accent600,
    features: [
      "Live truck location",
      "ETA updates",
      "Route optimization",
    ],
  ),
  OnboardingPage(
    title: "Smart Load Matching",
    description: "Our intelligent system matches your loads with the best available trucks based on route, capacity, and ratings.",
    icon: Icons.hub_rounded,
    iconBgColor: Color(0xFFD1FAE5), // emerald-100
    iconColor: Color(0xFF059669), // emerald-600
    features: [
      "AI-powered matching",
      "Best price discovery",
      "Instant notifications",
    ],
  ),
  OnboardingPage(
    title: "Secure Digital Payments",
    description: "Escrow-protected payments ensure secure transactions. Get paid fast with instant settlements.",
    icon: Icons.account_balance_wallet_rounded,
    iconBgColor: AppColors.primary100,
    iconColor: AppColors.primary600,
    features: [
      "Escrow protection",
      "Instant settlements",
      "Transaction history",
    ],
  ),
];

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _completeOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_complete', true);
    // Invalidate the provider so router sees the updated value
    ref.invalidate(onboardingCompleteProvider);
    if (mounted) {
      context.go('/login');
    }
  }

  void _nextPage() {
    if (_currentPage < onboardingPages.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
      );
    } else {
      _completeOnboarding();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppColors.primary900,
              AppColors.slate900,
            ],
            stops: [0.0, 0.35],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              // Header with Skip button
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Logo
                    Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [AppColors.primary500, AppColors.primary600],
                            ),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(
                            Icons.local_shipping,
                            color: Colors.white,
                            size: 24,
                          ),
                        ),
                        const SizedBox(width: 10),
                        const Text(
                          'FreightFlow',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                    // Skip button
                    if (_currentPage < onboardingPages.length - 1)
                      TextButton(
                        onPressed: _completeOnboarding,
                        child: const Text(
                          'Skip',
                          style: TextStyle(
                            color: AppColors.primary300,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                  ],
                ),
              ),

              // Page content
              Expanded(
                child: PageView.builder(
                  controller: _pageController,
                  onPageChanged: (index) {
                    setState(() {
                      _currentPage = index;
                    });
                  },
                  itemCount: onboardingPages.length,
                  itemBuilder: (context, index) {
                    return _OnboardingPageView(
                      page: onboardingPages[index],
                      isLastPage: index == onboardingPages.length - 1,
                    );
                  },
                ),
              ),

              // Bottom section with dots and button
              Container(
                padding: const EdgeInsets.all(24),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(32),
                    topRight: Radius.circular(32),
                  ),
                ),
                child: Column(
                  children: [
                    // Page indicators
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(
                        onboardingPages.length,
                        (index) => AnimatedContainer(
                          duration: const Duration(milliseconds: 300),
                          margin: const EdgeInsets.symmetric(horizontal: 4),
                          width: _currentPage == index ? 32 : 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: _currentPage == index
                                ? AppColors.primary600
                                : AppColors.slate200,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Next/Get Started button
                    SizedBox(
                      width: double.infinity,
                      child: Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: _currentPage == onboardingPages.length - 1
                                ? [AppColors.accent600, AppColors.accent500]
                                : [AppColors.primary700, AppColors.primary600],
                          ),
                          borderRadius: BorderRadius.circular(14),
                          boxShadow: [
                            BoxShadow(
                              color: (_currentPage == onboardingPages.length - 1
                                      ? AppColors.accent600
                                      : AppColors.primary600)
                                  .withValues(alpha: 0.35),
                              blurRadius: 16,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: ElevatedButton(
                          onPressed: _nextPage,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.transparent,
                            shadowColor: Colors.transparent,
                            padding: const EdgeInsets.symmetric(vertical: 18),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                _currentPage == onboardingPages.length - 1
                                    ? 'Get Started'
                                    : 'Next',
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Icon(
                                _currentPage == onboardingPages.length - 1
                                    ? Icons.arrow_forward_rounded
                                    : Icons.chevron_right_rounded,
                                color: Colors.white,
                                size: 20,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),

                    // Login link on last page
                    if (_currentPage == onboardingPages.length - 1) ...[
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Text(
                            'Already have an account? ',
                            style: TextStyle(
                              color: AppColors.slate500,
                              fontSize: 14,
                            ),
                          ),
                          GestureDetector(
                            onTap: _completeOnboarding,
                            child: const Text(
                              'Sign In',
                              style: TextStyle(
                                color: AppColors.primary600,
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Individual onboarding page view
class _OnboardingPageView extends StatelessWidget {
  final OnboardingPage page;
  final bool isLastPage;

  const _OnboardingPageView({
    required this.page,
    required this.isLastPage,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Icon container with decorative elements
          Stack(
            alignment: Alignment.center,
            children: [
              // Background glow
              Container(
                width: 180,
                height: 180,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      page.iconColor.withValues(alpha: 0.3),
                      page.iconColor.withValues(alpha: 0),
                    ],
                  ),
                ),
              ),
              // Icon container
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  color: page.iconBgColor,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: page.iconColor.withValues(alpha: 0.3),
                      blurRadius: 24,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Icon(
                  page.icon,
                  size: 56,
                  color: page.iconColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 48),

          // Title
          Text(
            page.title,
            style: const TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w700,
              color: Colors.white,
              letterSpacing: -0.5,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),

          // Description
          Text(
            page.description,
            style: const TextStyle(
              fontSize: 16,
              color: AppColors.slate300,
              height: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 32),

          // Feature list
          ...page.features.map((feature) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        color: page.iconColor.withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.check_rounded,
                        size: 16,
                        color: page.iconColor,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      feature,
                      style: const TextStyle(
                        fontSize: 15,
                        color: AppColors.slate200,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              )),
        ],
      ),
    );
  }
}
