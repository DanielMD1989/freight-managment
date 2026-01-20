import 'package:dio/dio.dart';
import '../api/api_client.dart';

/// Dashboard data for carrier
class CarrierDashboardData {
  final int totalTrucks;
  final int activeTrucks;
  final int activePostings;
  final int completedDeliveries;
  final int inTransitTrips;
  final double totalDistance;
  final double walletBalance;
  final String walletCurrency;
  final int recentPostings;
  final int pendingApprovals;

  CarrierDashboardData({
    required this.totalTrucks,
    required this.activeTrucks,
    required this.activePostings,
    required this.completedDeliveries,
    required this.inTransitTrips,
    required this.totalDistance,
    required this.walletBalance,
    required this.walletCurrency,
    required this.recentPostings,
    required this.pendingApprovals,
  });

  factory CarrierDashboardData.fromJson(Map<String, dynamic> json) {
    return CarrierDashboardData(
      totalTrucks: json['totalTrucks'] ?? 0,
      activeTrucks: json['activeTrucks'] ?? 0,
      activePostings: json['activePostings'] ?? 0,
      completedDeliveries: json['completedDeliveries'] ?? 0,
      inTransitTrips: json['inTransitTrips'] ?? 0,
      totalDistance: (json['totalDistance'] ?? 0).toDouble(),
      walletBalance: (json['wallet']?['balance'] ?? 0).toDouble(),
      walletCurrency: json['wallet']?['currency'] ?? 'ETB',
      recentPostings: json['recentPostings'] ?? 0,
      pendingApprovals: json['pendingApprovals'] ?? 0,
    );
  }
}

/// Dashboard data for shipper
class ShipperDashboardData {
  final int totalLoads;
  final int activeLoads;
  final int inTransitLoads;
  final int deliveredLoads;
  final double totalSpent;
  final int pendingPayments;
  final double walletBalance;
  final String walletCurrency;

  ShipperDashboardData({
    required this.totalLoads,
    required this.activeLoads,
    required this.inTransitLoads,
    required this.deliveredLoads,
    required this.totalSpent,
    required this.pendingPayments,
    required this.walletBalance,
    required this.walletCurrency,
  });

  factory ShipperDashboardData.fromJson(Map<String, dynamic> json) {
    final stats = json['stats'] ?? json;
    return ShipperDashboardData(
      totalLoads: stats['totalLoads'] ?? 0,
      activeLoads: stats['activeLoads'] ?? 0,
      inTransitLoads: stats['inTransitLoads'] ?? 0,
      deliveredLoads: stats['deliveredLoads'] ?? 0,
      totalSpent: (stats['totalSpent'] ?? 0).toDouble(),
      pendingPayments: stats['pendingPayments'] ?? 0,
      walletBalance: (json['wallet']?['balance'] ?? 0).toDouble(),
      walletCurrency: json['wallet']?['currency'] ?? 'ETB',
    );
  }
}

/// Dashboard service for fetching dashboard statistics
class DashboardService {
  final ApiClient _apiClient = ApiClient();

  /// Get carrier dashboard data
  Future<ApiResponse<CarrierDashboardData>> getCarrierDashboard() async {
    try {
      final response = await _apiClient.dio.get('/api/carrier/dashboard');

      if (response.statusCode == 200) {
        final data = CarrierDashboardData.fromJson(response.data);
        return ApiResponse.success(data);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to load dashboard',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Get shipper dashboard data
  Future<ApiResponse<ShipperDashboardData>> getShipperDashboard() async {
    try {
      final response = await _apiClient.dio.get('/api/shipper/dashboard');

      if (response.statusCode == 200) {
        final data = ShipperDashboardData.fromJson(response.data);
        return ApiResponse.success(data);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to load dashboard',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }
}
