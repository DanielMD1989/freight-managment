import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/trip.dart';
import '../utils/foundation_rules.dart';

/// Trip service for managing trip operations
/// FOUNDATION RULES ENFORCED:
/// - CARRIER_FINAL_AUTHORITY: Only carriers can start/progress trips
class TripService {
  final ApiClient _apiClient = ApiClient();

  /// Get current user role from storage
  Future<UserRole> _getCurrentUserRole() async {
    final roleStr = await _apiClient.getCurrentUserRole();
    return userRoleFromString(roleStr);
  }

  /// Get all trips for the carrier
  Future<ApiResponse<List<Trip>>> getTrips({
    int limit = 50,
    int offset = 0,
    String? status,
  }) async {
    try {
      final params = <String, dynamic>{
        'limit': limit.toString(),
        'offset': offset.toString(),
      };
      if (status != null) params['status'] = status;

      final response = await _apiClient.dio.get(
        '/api/trips',
        queryParameters: params,
      );

      if (response.statusCode == 200) {
        final tripsData = response.data['trips'] ?? response.data;
        final trips = (tripsData as List)
            .map((json) => Trip.fromJson(json))
            .toList();
        return ApiResponse.success(trips);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to load trips',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred: $e');
    }
  }

  /// Get a single trip by ID
  Future<ApiResponse<Trip>> getTripById(String id) async {
    try {
      final response = await _apiClient.dio.get('/api/trips/$id');

      if (response.statusCode == 200) {
        // API may return { trip: {...} } or just the trip object
        final tripData = response.data['trip'] ?? response.data;
        final trip = Trip.fromJson(tripData);
        return ApiResponse.success(trip);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Trip not found',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred: $e');
    }
  }

  /// Update trip status
  /// ENFORCES: RULE_CARRIER_FINAL_AUTHORITY - Only carriers can update trip status
  Future<ApiResponse<Trip>> updateTripStatus({
    required String tripId,
    required String status,
    String? receiverName,
    String? receiverPhone,
    String? deliveryNotes,
  }) async {
    try {
      // FOUNDATION RULE CHECK: Only carriers can update trip status
      final role = await _getCurrentUserRole();
      try {
        assertCanStartTrip(role);
      } on FoundationRuleViolation catch (e) {
        return ApiResponse.error(e.message, statusCode: 403);
      }

      final data = <String, dynamic>{
        'status': status,
      };
      if (receiverName != null) data['receiverName'] = receiverName;
      if (receiverPhone != null) data['receiverPhone'] = receiverPhone;
      if (deliveryNotes != null) data['deliveryNotes'] = deliveryNotes;

      final response = await _apiClient.dio.patch(
        '/api/trips/$tripId',
        data: data,
      );

      if (response.statusCode == 200) {
        // API may return { trip: {...} } or just the trip object
        final tripData = response.data['trip'] ?? response.data;
        final trip = Trip.fromJson(tripData);
        return ApiResponse.success(trip);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to update trip',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred: $e');
    }
  }

  /// Start trip (ASSIGNED -> PICKUP_PENDING)
  /// ENFORCES: RULE_CARRIER_FINAL_AUTHORITY - Only carriers can start trips
  Future<ApiResponse<Trip>> startTrip(String tripId) async {
    return updateTripStatus(tripId: tripId, status: 'PICKUP_PENDING');
  }

  /// Mark picked up (PICKUP_PENDING -> IN_TRANSIT)
  /// ENFORCES: RULE_CARRIER_FINAL_AUTHORITY - Only carriers can mark pickup
  Future<ApiResponse<Trip>> markPickedUp(String tripId) async {
    return updateTripStatus(tripId: tripId, status: 'IN_TRANSIT');
  }

  /// Mark delivered (IN_TRANSIT -> DELIVERED)
  /// ENFORCES: RULE_CARRIER_FINAL_AUTHORITY - Only carriers can mark delivery
  Future<ApiResponse<Trip>> markDelivered({
    required String tripId,
    required String receiverName,
    required String receiverPhone,
    String? deliveryNotes,
  }) async {
    return updateTripStatus(
      tripId: tripId,
      status: 'DELIVERED',
      receiverName: receiverName,
      receiverPhone: receiverPhone,
      deliveryNotes: deliveryNotes,
    );
  }

  /// Cancel trip
  /// ENFORCES: RULE_CARRIER_FINAL_AUTHORITY - Only carriers can cancel trips
  Future<ApiResponse<Trip>> cancelTrip({
    required String tripId,
    required String reason,
  }) async {
    try {
      // FOUNDATION RULE CHECK: Only carriers can cancel trips
      final role = await _getCurrentUserRole();
      try {
        assertCanStartTrip(role);
      } on FoundationRuleViolation catch (e) {
        return ApiResponse.error(e.message, statusCode: 403);
      }

      final response = await _apiClient.dio.post(
        '/api/trips/$tripId/cancel',
        data: {'reason': reason},
      );

      if (response.statusCode == 200) {
        final trip = Trip.fromJson(response.data);
        return ApiResponse.success(trip);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to cancel trip',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Upload POD (Proof of Delivery)
  Future<ApiResponse<bool>> uploadPod({
    required String tripId,
    required String filePath,
    required String fileName,
    String? notes,
  }) async {
    try {
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(filePath, filename: fileName),
        if (notes != null) 'notes': notes,
      });

      final response = await _apiClient.dio.post(
        '/api/trips/$tripId/pod',
        data: formData,
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return ApiResponse.success(true);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to upload POD',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Get trip POD documents
  Future<ApiResponse<List<TripPod>>> getTripPods(String tripId) async {
    try {
      final response = await _apiClient.dio.get('/api/trips/$tripId/pod');

      if (response.statusCode == 200) {
        final podsData = response.data['pods'] ?? response.data;
        final pods = (podsData as List)
            .map((json) => TripPod.fromJson(json))
            .toList();
        return ApiResponse.success(pods);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to load PODs',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Get trip GPS history
  Future<ApiResponse<List<GpsPosition>>> getTripGpsHistory(String tripId) async {
    try {
      final response = await _apiClient.dio.get('/api/trips/$tripId/history');

      if (response.statusCode == 200) {
        final positionsData = response.data['positions'] ?? response.data;
        final positions = (positionsData as List)
            .map((json) => GpsPosition.fromJson(json))
            .toList();
        return ApiResponse.success(positions);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to load GPS history',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Get live trip position
  Future<ApiResponse<GpsPosition?>> getTripLivePosition(String tripId) async {
    try {
      final response = await _apiClient.dio.get('/api/trips/$tripId/live');

      if (response.statusCode == 200 && response.data != null) {
        final position = GpsPosition.fromJson(response.data);
        return ApiResponse.success(position);
      }

      return ApiResponse.success(null);
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }
}
