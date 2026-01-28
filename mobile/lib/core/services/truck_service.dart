import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show debugPrint;
import '../api/api_client.dart';
import '../models/truck.dart';
import '../utils/foundation_rules.dart';

/// Truck service for CRUD operations
/// FOUNDATION RULES ENFORCED:
/// - CARRIER_OWNS_TRUCKS: Only carriers can create/edit/delete trucks
/// - CARRIER_FINAL_AUTHORITY: Only carriers can respond to truck requests
class TruckService {
  final ApiClient _apiClient = ApiClient();

  /// Get current user role from storage
  Future<UserRole> _getCurrentUserRole() async {
    final roleStr = await _apiClient.getCurrentUserRole();
    return userRoleFromString(roleStr);
  }

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
  /// ENFORCES: RULE_CARRIER_OWNS_TRUCKS - Only carriers can create trucks
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
      // FOUNDATION RULE CHECK: Only carriers can create trucks
      final role = await _getCurrentUserRole();
      try {
        assertCanModifyTruck(role);
      } on FoundationRuleViolation catch (e) {
        return ApiResponse.error(e.message, statusCode: 403);
      }

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
  /// ENFORCES: RULE_CARRIER_OWNS_TRUCKS - Only carriers can update trucks
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
      // FOUNDATION RULE CHECK: Only carriers can update trucks
      final role = await _getCurrentUserRole();
      try {
        assertCanModifyTruck(role);
      } on FoundationRuleViolation catch (e) {
        return ApiResponse.error(e.message, statusCode: 403);
      }

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
  /// ENFORCES: RULE_CARRIER_OWNS_TRUCKS - Only carriers can delete trucks
  Future<ApiResponse<bool>> deleteTruck(String id) async {
    try {
      // FOUNDATION RULE CHECK: Only carriers can delete trucks
      final role = await _getCurrentUserRole();
      try {
        assertCanModifyTruck(role);
      } on FoundationRuleViolation catch (e) {
        return ApiResponse.error(e.message, statusCode: 403);
      }

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

  /// Search trucks on the marketplace (for shippers) - LEGACY method
  /// @deprecated Use searchTruckPostings() for full posting data with direction
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

  /// Search truck postings with FULL posting data (WEB PARITY)
  /// Returns TruckPosting objects with origin/destination, age, availability
  /// Matches web SearchTrucksTab.tsx filter parameters
  Future<ApiResponse<TruckPostingSearchResult>> searchTruckPostings({
    int page = 1,
    int limit = 20,
    String? origin,        // origin city filter (availableCity)
    String? destination,   // destination city filter (WEB PARITY)
    String? truckType,
    String? fullPartial,   // FULL, PARTIAL, BOTH (WEB PARITY)
    double? minLength,     // minimum trailer length (WEB PARITY)
    double? maxWeight,     // maximum weight capacity (WEB PARITY)
    DateTime? availableFrom, // availability date filter (WEB PARITY)
    int? ageHours,         // max posting age in hours (WEB PARITY)
    String? sortBy,
    String? sortOrder,
  }) async {
    try {
      final params = <String, dynamic>{
        'page': page.toString(),
        'limit': limit.toString(),
        'status': 'ACTIVE', // Only show active postings
      };

      // Origin filter (matches web's "origin" filter)
      if (origin != null && origin.isNotEmpty) {
        params['origin'] = origin;
      }
      // Destination filter (WEB PARITY - web uses "destination")
      if (destination != null && destination.isNotEmpty) {
        params['destination'] = destination;
      }
      if (truckType != null) params['truckType'] = truckType;
      // Full/Partial filter (WEB PARITY)
      if (fullPartial != null) params['fullPartial'] = fullPartial;
      // Length filter (WEB PARITY)
      if (minLength != null) params['minLength'] = minLength.toString();
      // Weight filter (WEB PARITY)
      if (maxWeight != null) params['maxWeight'] = maxWeight.toString();
      // Availability date filter (WEB PARITY)
      if (availableFrom != null) {
        params['availableFrom'] = availableFrom.toIso8601String().split('T')[0];
      }
      // Age filter (WEB PARITY - filter by posting age)
      if (ageHours != null) params['ageHours'] = ageHours.toString();
      if (sortBy != null) params['sortBy'] = sortBy;
      if (sortOrder != null) params['sortOrder'] = sortOrder;

      final response = await _apiClient.dio.get(
        '/api/truck-postings',
        queryParameters: params,
      );

      if (response.statusCode == 200) {
        // Parse full posting data (NOT just the truck)
        final postingsData = response.data['truckPostings'] ??
                            response.data['postings'] ??
                            response.data['trucks'] ?? [];
        final postings = (postingsData as List)
            .map((json) => TruckPosting.fromJson(json))
            .toList();
        final pagination = response.data['pagination'] ?? {};

        return ApiResponse.success(TruckPostingSearchResult(
          postings: postings,
          page: pagination['page'] ?? page,
          limit: pagination['limit'] ?? limit,
          total: pagination['total'] ?? postings.length,
          pages: pagination['pages'] ?? 1,
        ));
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to search truck postings',
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
  /// ENFORCES: RULE_CARRIER_FINAL_AUTHORITY - Only carriers can approve/reject truck requests
  Future<ApiResponse<TruckRequest>> respondToTruckRequest({
    required String requestId,
    required String action, // APPROVE or REJECT
    String? responseNotes,
  }) async {
    try {
      // FOUNDATION RULE CHECK: Only carriers can respond to truck requests
      final role = await _getCurrentUserRole();
      try {
        assertCanModifyTruck(role); // Carriers own trucks, so they respond
      } on FoundationRuleViolation catch (e) {
        return ApiResponse.error(e.message, statusCode: 403);
      }

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

  /// Cancel a pending truck request (shipper cancels their own request)
  /// Per RequestStateMachine: Only PENDING requests can be cancelled
  Future<ApiResponse<TruckRequest>> cancelTruckRequest({
    required String requestId,
    String? cancellationReason,
  }) async {
    try {
      final data = <String, dynamic>{
        'action': 'CANCEL',
      };
      if (cancellationReason != null) {
        data['cancellationReason'] = cancellationReason;
      }

      final response = await _apiClient.dio.post(
        '/api/truck-requests/$requestId/cancel',
        data: data,
      );

      if (response.statusCode == 200) {
        final request =
            TruckRequest.fromJson(response.data['request'] ?? response.data);
        return ApiResponse.success(request);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to cancel request',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  // ========== TRUCK POSTING METHODS ==========

  /// Get Ethiopian locations for city selection
  Future<ApiResponse<List<EthiopianLocation>>> getEthiopianLocations() async {
    try {
      final response = await _apiClient.dio.get('/api/ethiopian-locations');

      if (response.statusCode == 200) {
        final locations = (response.data['locations'] as List? ?? [])
            .map((json) => EthiopianLocation.fromJson(json))
            .toList();
        return ApiResponse.success(locations);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to load locations',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Get carrier's truck postings
  Future<ApiResponse<TruckPostingsResult>> getMyTruckPostings({
    String status = 'ACTIVE',
    int limit = 50,
    int offset = 0,
  }) async {
    try {
      final params = <String, dynamic>{
        'status': status,
        'limit': limit.toString(),
        'offset': offset.toString(),
      };

      final response = await _apiClient.dio.get(
        '/api/truck-postings',
        queryParameters: params,
      );

      if (response.statusCode == 200) {
        final postingsData = response.data['truckPostings'] ?? response.data['postings'] ?? [];
        final postings = (postingsData as List)
            .map((json) => TruckPosting.fromJson(json))
            .toList();
        final pagination = response.data['pagination'] ?? {};

        return ApiResponse.success(TruckPostingsResult(
          postings: postings,
          total: pagination['total'] ?? postings.length,
        ));
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to load truck postings',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred: $e');
    }
  }

  /// Create a new truck posting
  Future<ApiResponse<TruckPosting>> createTruckPosting({
    required String truckId,
    required String originCityId,
    String? destinationCityId,
    required DateTime availableFrom,
    DateTime? availableTo,
    String fullPartial = 'FULL',
    double? availableLength,
    double? availableWeight,
    double? preferredDhToOriginKm,
    double? preferredDhAfterDeliveryKm,
    required String contactName,
    required String contactPhone,
    String? ownerName,
    String? notes,
  }) async {
    try {
      final data = <String, dynamic>{
        'truckId': truckId,
        'originCityId': originCityId,
        'availableFrom': availableFrom.toIso8601String(),
        'fullPartial': fullPartial,
        'contactName': contactName,
        'contactPhone': contactPhone,
      };
      if (destinationCityId != null) data['destinationCityId'] = destinationCityId;
      if (availableTo != null) data['availableTo'] = availableTo.toIso8601String();
      if (availableLength != null) data['availableLength'] = availableLength;
      if (availableWeight != null) data['availableWeight'] = availableWeight;
      if (preferredDhToOriginKm != null) data['preferredDhToOriginKm'] = preferredDhToOriginKm;
      if (preferredDhAfterDeliveryKm != null) data['preferredDhAfterDeliveryKm'] = preferredDhAfterDeliveryKm;
      if (ownerName != null) data['ownerName'] = ownerName;
      if (notes != null) data['notes'] = notes;

      // Debug logging (only in debug mode)
      assert(() {
        debugPrint('[TruckService] Creating truck posting with data: $data');
        return true;
      }());

      final response = await _apiClient.dio.post('/api/truck-postings', data: data);

      assert(() {
        debugPrint('[TruckService] Response status: ${response.statusCode}');
        debugPrint('[TruckService] Response data: ${response.data}');
        return true;
      }());

      if (response.statusCode == 201) {
        final posting = TruckPosting.fromJson(response.data['truckPosting'] ?? response.data);
        return ApiResponse.success(posting);
      }

      // Handle validation errors with details
      String errorMsg = response.data['error'] ?? 'Failed to create truck posting';
      if (response.data['details'] != null) {
        final details = response.data['details'] as List;
        if (details.isNotEmpty) {
          final firstError = details.first;
          errorMsg = '${firstError['path']?.join('.') ?? 'Field'}: ${firstError['message'] ?? errorMsg}';
        }
      }

      return ApiResponse.error(errorMsg, statusCode: response.statusCode);
    } on DioException catch (e) {
      // Extract detailed error from response if available
      String errorMsg = e.friendlyMessage;
      if (e.response?.data != null) {
        final data = e.response!.data;
        if (data is Map) {
          errorMsg = data['error'] ?? errorMsg;
          if (data['details'] != null) {
            final details = data['details'] as List;
            if (details.isNotEmpty) {
              final firstError = details.first;
              errorMsg = '${firstError['path']?.join('.') ?? 'Field'}: ${firstError['message'] ?? errorMsg}';
            }
          }
        }
      }
      return ApiResponse.error(errorMsg, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred: $e');
    }
  }

  /// Update a truck posting
  Future<ApiResponse<TruckPosting>> updateTruckPosting({
    required String postingId,
    String? originCityId,
    String? destinationCityId,
    DateTime? availableFrom,
    DateTime? availableTo,
    String? fullPartial,
    double? availableLength,
    double? availableWeight,
    String? contactName,
    String? contactPhone,
    String? notes,
    String? status,
  }) async {
    try {
      final data = <String, dynamic>{};
      if (originCityId != null) data['originCityId'] = originCityId;
      if (destinationCityId != null) data['destinationCityId'] = destinationCityId;
      if (availableFrom != null) data['availableFrom'] = availableFrom.toIso8601String();
      if (availableTo != null) data['availableTo'] = availableTo.toIso8601String();
      if (fullPartial != null) data['fullPartial'] = fullPartial;
      if (availableLength != null) data['availableLength'] = availableLength;
      if (availableWeight != null) data['availableWeight'] = availableWeight;
      if (contactName != null) data['contactName'] = contactName;
      if (contactPhone != null) data['contactPhone'] = contactPhone;
      if (notes != null) data['notes'] = notes;
      if (status != null) data['status'] = status;

      final response = await _apiClient.dio.patch(
        '/api/truck-postings/$postingId',
        data: data,
      );

      if (response.statusCode == 200) {
        final posting = TruckPosting.fromJson(response.data['truckPosting'] ?? response.data);
        return ApiResponse.success(posting);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to update truck posting',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Delete/unpost a truck posting
  Future<ApiResponse<bool>> deleteTruckPosting(String postingId) async {
    try {
      final response = await _apiClient.dio.delete('/api/truck-postings/$postingId');

      if (response.statusCode == 200) {
        return ApiResponse.success(true);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to delete truck posting',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Get matching loads for a truck posting
  Future<ApiResponse<List<MatchingLoad>>> getMatchingLoadsForPosting(
    String postingId, {
    int limit = 50,
  }) async {
    try {
      final response = await _apiClient.dio.get(
        '/api/truck-postings/$postingId/matching-loads',
        queryParameters: {'limit': limit.toString()},
      );

      if (response.statusCode == 200) {
        final matchesData = response.data['matches'] ?? [];
        final matches = (matchesData as List)
            .map((json) => MatchingLoad.fromJson(json))
            .toList();
        return ApiResponse.success(matches);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to load matching loads',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }
}

/// Truck search result with pagination (LEGACY - use TruckPostingSearchResult)
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

/// Truck POSTING search result with FULL posting data (WEB PARITY)
/// Includes origin/destination direction, age, availability, carrier info
class TruckPostingSearchResult {
  final List<TruckPosting> postings;
  final int page;
  final int limit;
  final int total;
  final int pages;

  TruckPostingSearchResult({
    required this.postings,
    required this.page,
    required this.limit,
    required this.total,
    required this.pages,
  });

  bool get hasMore => page < pages;
}

/// Ethiopian location for city selection
class EthiopianLocation {
  final String id;
  final String name;
  final String region;
  final double? latitude;
  final double? longitude;

  EthiopianLocation({
    required this.id,
    required this.name,
    required this.region,
    this.latitude,
    this.longitude,
  });

  factory EthiopianLocation.fromJson(Map<String, dynamic> json) {
    return EthiopianLocation(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      region: json['region'] ?? '',
      latitude: json['latitude']?.toDouble(),
      longitude: json['longitude']?.toDouble(),
    );
  }

  @override
  String toString() => name;
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
  bool get isCancelled => status == 'CANCELLED';
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

/// Result container for truck postings
class TruckPostingsResult {
  final List<TruckPosting> postings;
  final int total;

  TruckPostingsResult({
    required this.postings,
    required this.total,
  });
}

/// Matching load from truck posting match
class MatchingLoad {
  final String id;
  final String? pickupCity;
  final String? deliveryCity;
  final double? weight;
  final String? truckType;
  final String? cargoDescription;
  final DateTime? pickupDate;
  final String? fullPartial;
  final double? distanceToOrigin;
  final double? distanceAfterDelivery;
  final int? matchScore;

  MatchingLoad({
    required this.id,
    this.pickupCity,
    this.deliveryCity,
    this.weight,
    this.truckType,
    this.cargoDescription,
    this.pickupDate,
    this.fullPartial,
    this.distanceToOrigin,
    this.distanceAfterDelivery,
    this.matchScore,
  });

  factory MatchingLoad.fromJson(Map<String, dynamic> json) {
    final load = json['load'] ?? json;
    return MatchingLoad(
      id: load['id'] ?? '',
      pickupCity: load['pickupCity'],
      deliveryCity: load['deliveryCity'],
      weight: load['weight']?.toDouble(),
      truckType: load['truckType'],
      cargoDescription: load['cargoDescription'],
      pickupDate: load['pickupDate'] != null
          ? DateTime.parse(load['pickupDate'])
          : null,
      fullPartial: load['fullPartial'],
      distanceToOrigin: json['distanceToOrigin']?.toDouble(),
      distanceAfterDelivery: json['distanceAfterDelivery']?.toDouble(),
      matchScore: json['matchScore'],
    );
  }

  String get route => '${pickupCity ?? "N/A"} → ${deliveryCity ?? "N/A"}';
  String get weightDisplay => weight != null
      ? '${(weight! / 1000).toStringAsFixed(1)} tons'
      : 'N/A';
}
