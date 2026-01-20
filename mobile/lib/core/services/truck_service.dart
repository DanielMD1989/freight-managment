import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/truck.dart';

/// Truck service for CRUD operations
class TruckService {
  final ApiClient _apiClient = ApiClient();

  /// Get all trucks for the carrier
  Future<ApiResponse<List<Truck>>> getTrucks({
    int limit = 50,
    int offset = 0,
    String? status,
    String? approvalStatus,
  }) async {
    try {
      final params = <String, dynamic>{
        'limit': limit.toString(),
        'offset': offset.toString(),
      };
      if (status != null) params['status'] = status;
      if (approvalStatus != null) params['approvalStatus'] = approvalStatus;

      final response = await _apiClient.dio.get(
        '/api/trucks',
        queryParameters: params,
      );

      if (response.statusCode == 200) {
        final trucksData = response.data['trucks'] ?? response.data;
        final trucks = (trucksData as List)
            .map((json) => Truck.fromJson(json))
            .toList();
        return ApiResponse.success(trucks);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to load trucks',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred: $e');
    }
  }

  /// Get a single truck by ID
  Future<ApiResponse<Truck>> getTruckById(String id) async {
    try {
      final response = await _apiClient.dio.get('/api/trucks/$id');

      if (response.statusCode == 200) {
        final truck = Truck.fromJson(response.data);
        return ApiResponse.success(truck);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Truck not found',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Create a new truck
  Future<ApiResponse<Truck>> createTruck({
    required String licensePlate,
    required String truckType,
    required double capacity,
    double? volume,
    String? currentCity,
    String? currentRegion,
    String? ownerName,
    String? contactName,
    String? contactPhone,
    double? lengthM,
  }) async {
    try {
      final response = await _apiClient.dio.post(
        '/api/trucks',
        data: {
          'licensePlate': licensePlate,
          'truckType': truckType,
          'capacity': capacity,
          if (volume != null) 'volume': volume,
          if (currentCity != null) 'currentCity': currentCity,
          if (currentRegion != null) 'currentRegion': currentRegion,
          if (ownerName != null) 'ownerName': ownerName,
          if (contactName != null) 'contactName': contactName,
          if (contactPhone != null) 'contactPhone': contactPhone,
          if (lengthM != null) 'lengthM': lengthM,
        },
      );

      if (response.statusCode == 201) {
        final truck = Truck.fromJson(response.data);
        return ApiResponse.success(truck);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to create truck',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Update a truck
  Future<ApiResponse<Truck>> updateTruck({
    required String id,
    String? licensePlate,
    String? truckType,
    double? capacity,
    double? volume,
    bool? isAvailable,
    String? currentCity,
    String? currentRegion,
    String? ownerName,
    String? contactName,
    String? contactPhone,
    double? lengthM,
  }) async {
    try {
      final data = <String, dynamic>{};
      if (licensePlate != null) data['licensePlate'] = licensePlate;
      if (truckType != null) data['truckType'] = truckType;
      if (capacity != null) data['capacity'] = capacity;
      if (volume != null) data['volume'] = volume;
      if (isAvailable != null) data['isAvailable'] = isAvailable;
      if (currentCity != null) data['currentCity'] = currentCity;
      if (currentRegion != null) data['currentRegion'] = currentRegion;
      if (ownerName != null) data['ownerName'] = ownerName;
      if (contactName != null) data['contactName'] = contactName;
      if (contactPhone != null) data['contactPhone'] = contactPhone;
      if (lengthM != null) data['lengthM'] = lengthM;

      final response = await _apiClient.dio.put(
        '/api/trucks/$id',
        data: data,
      );

      if (response.statusCode == 200) {
        final truck = Truck.fromJson(response.data);
        return ApiResponse.success(truck);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to update truck',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Delete a truck
  Future<ApiResponse<bool>> deleteTruck(String id) async {
    try {
      final response = await _apiClient.dio.delete('/api/trucks/$id');

      if (response.statusCode == 200) {
        return ApiResponse.success(true);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to delete truck',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Toggle truck availability
  Future<ApiResponse<Truck>> toggleAvailability(String id, bool isAvailable) async {
    return updateTruck(id: id, isAvailable: isAvailable);
  }
}
