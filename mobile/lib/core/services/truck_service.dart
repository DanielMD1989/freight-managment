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

  /// Search trucks on the marketplace (for shippers)
  Future<ApiResponse<TruckSearchResult>> searchTrucks({
    int page = 1,
    int limit = 20,
    String? availableCity,
    String? truckType,
    double? minCapacity,
    double? maxCapacity,
    bool? isAvailable,
    String? sortBy,
    String? sortOrder,
  }) async {
    try {
      final params = <String, dynamic>{
        'page': page.toString(),
        'limit': limit.toString(),
      };

      if (availableCity != null && availableCity.isNotEmpty) {
        params['availableCity'] = availableCity;
      }
      if (truckType != null) params['truckType'] = truckType;
      if (minCapacity != null) params['minCapacity'] = minCapacity.toString();
      if (maxCapacity != null) params['maxCapacity'] = maxCapacity.toString();
      if (isAvailable != null) params['isAvailable'] = isAvailable.toString();
      if (sortBy != null) params['sortBy'] = sortBy;
      if (sortOrder != null) params['sortOrder'] = sortOrder;

      final response = await _apiClient.dio.get(
        '/api/truck-postings',
        queryParameters: params,
      );

      if (response.statusCode == 200) {
        final trucksData = response.data['trucks'] ?? response.data['postings'] ?? [];
        final trucks = (trucksData as List)
            .map((json) => Truck.fromJson(json['truck'] ?? json))
            .toList();
        final pagination = response.data['pagination'] ?? {};

        return ApiResponse.success(TruckSearchResult(
          trucks: trucks,
          page: pagination['page'] ?? page,
          limit: pagination['limit'] ?? limit,
          total: pagination['total'] ?? trucks.length,
          pages: pagination['pages'] ?? 1,
        ));
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to search trucks',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred: $e');
    }
  }

  /// Request a truck (shipper books a truck)
  Future<ApiResponse<TruckRequest>> requestTruck({
    required String truckId,
    required String loadId,
    String? notes,
    int expiresInHours = 24,
  }) async {
    try {
      final data = <String, dynamic>{
        'truckId': truckId,
        'loadId': loadId,
        'expiresInHours': expiresInHours,
      };
      if (notes != null && notes.isNotEmpty) data['notes'] = notes;

      final response = await _apiClient.dio.post('/api/truck-requests', data: data);

      if (response.statusCode == 201) {
        final request = TruckRequest.fromJson(response.data['truckRequest'] ?? response.data);
        return ApiResponse.success(request);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to request truck',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred: $e');
    }
  }

  /// Get truck requests (for shipper to see their outgoing requests)
  Future<ApiResponse<List<TruckRequest>>> getTruckRequests({
    String? status,
    String? truckId,
    int limit = 50,
    int offset = 0,
  }) async {
    try {
      final params = <String, dynamic>{
        'limit': limit.toString(),
        'offset': offset.toString(),
      };
      if (status != null) params['status'] = status;
      if (truckId != null) params['truckId'] = truckId;

      final response = await _apiClient.dio.get(
        '/api/truck-requests',
        queryParameters: params,
      );

      if (response.statusCode == 200) {
        final requests = (response.data['truckRequests'] as List? ?? [])
            .map((json) => TruckRequest.fromJson(json))
            .toList();
        return ApiResponse.success(requests);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to load truck requests',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Respond to a truck request (carrier approves/rejects)
  Future<ApiResponse<TruckRequest>> respondToTruckRequest({
    required String requestId,
    required String action, // APPROVE or REJECT
    String? responseNotes,
  }) async {
    try {
      final data = <String, dynamic>{
        'action': action,
      };
      if (responseNotes != null) data['responseNotes'] = responseNotes;

      final response = await _apiClient.dio.post(
        '/api/truck-requests/$requestId/respond',
        data: data,
      );

      if (response.statusCode == 200) {
        final request = TruckRequest.fromJson(response.data['request'] ?? response.data);
        return ApiResponse.success(request);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to respond to request',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }
}

/// Truck search result with pagination
class TruckSearchResult {
  final List<Truck> trucks;
  final int page;
  final int limit;
  final int total;
  final int pages;

  TruckSearchResult({
    required this.trucks,
    required this.page,
    required this.limit,
    required this.total,
    required this.pages,
  });

  bool get hasMore => page < pages;
}

/// Truck request model
class TruckRequest {
  final String id;
  final String status;
  final String truckId;
  final String loadId;
  final String shipperId;
  final String carrierId;
  final String? notes;
  final String? responseNotes;
  final DateTime? expiresAt;
  final DateTime? respondedAt;
  final DateTime createdAt;
  final Truck? truck;
  final TruckRequestLoad? load;

  TruckRequest({
    required this.id,
    required this.status,
    required this.truckId,
    required this.loadId,
    required this.shipperId,
    required this.carrierId,
    this.notes,
    this.responseNotes,
    this.expiresAt,
    this.respondedAt,
    required this.createdAt,
    this.truck,
    this.load,
  });

  factory TruckRequest.fromJson(Map<String, dynamic> json) {
    return TruckRequest(
      id: json['id'] ?? '',
      status: json['status'] ?? 'PENDING',
      truckId: json['truckId'] ?? '',
      loadId: json['loadId'] ?? '',
      shipperId: json['shipperId'] ?? '',
      carrierId: json['carrierId'] ?? '',
      notes: json['notes'],
      responseNotes: json['responseNotes'],
      expiresAt: json['expiresAt'] != null
          ? DateTime.parse(json['expiresAt'])
          : null,
      respondedAt: json['respondedAt'] != null
          ? DateTime.parse(json['respondedAt'])
          : null,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
      truck: json['truck'] != null ? Truck.fromJson(json['truck']) : null,
      load: json['load'] != null ? TruckRequestLoad.fromJson(json['load']) : null,
    );
  }

  bool get isPending => status == 'PENDING';
  bool get isApproved => status == 'APPROVED';
  bool get isRejected => status == 'REJECTED';
  bool get isExpired => status == 'EXPIRED';
}

/// Minimal load info for truck requests
class TruckRequestLoad {
  final String id;
  final String? pickupCity;
  final String? deliveryCity;
  final double? weight;
  final String? truckType;

  TruckRequestLoad({
    required this.id,
    this.pickupCity,
    this.deliveryCity,
    this.weight,
    this.truckType,
  });

  factory TruckRequestLoad.fromJson(Map<String, dynamic> json) {
    return TruckRequestLoad(
      id: json['id'] ?? '',
      pickupCity: json['pickupCity'],
      deliveryCity: json['deliveryCity'],
      weight: json['weight']?.toDouble(),
      truckType: json['truckType'],
    );
  }

  String get route => '${pickupCity ?? "N/A"} → ${deliveryCity ?? "N/A"}';
  String get weightDisplay => weight != null
      ? '${(weight! / 1000).toStringAsFixed(1)} tons'
      : 'N/A';
}
