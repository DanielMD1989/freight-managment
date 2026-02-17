import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/load.dart';
import '../models/truck.dart';
import '../utils/foundation_rules.dart';

/// Load service for searching and managing loads
/// FOUNDATION RULES ENFORCED:
/// - SHIPPER_DEMAND_FOCUS: Shippers post/manage their own loads
/// - CARRIER_FINAL_AUTHORITY: Carriers respond to load requests (shippers approve)
class LoadService {
  final ApiClient _apiClient = ApiClient();

  /// Get current user role from storage
  Future<UserRole> _getCurrentUserRole() async {
    final roleStr = await _apiClient.getCurrentUserRole();
    return userRoleFromString(roleStr);
  }

  /// Search loads on the marketplace
  Future<ApiResponse<LoadSearchResult>> searchLoads({
    int page = 1,
    int limit = 20,
    String? status,
    String? pickupCity,
    String? deliveryCity,
    String? truckType,
    double? tripKmMin,
    double? tripKmMax,
    String? fullPartial,
    String? bookMode,
    double? rateMin,
    double? rateMax,
    String? sortBy,
    String? sortOrder,
    bool? myLoads,
    bool? myTrips,
  }) async {
    try {
      final params = <String, dynamic>{
        'page': page.toString(),
        'limit': limit.toString(),
      };

      if (status != null) params['status'] = status;
      if (pickupCity != null && pickupCity.isNotEmpty) params['pickupCity'] = pickupCity;
      if (deliveryCity != null && deliveryCity.isNotEmpty) params['deliveryCity'] = deliveryCity;
      if (truckType != null) params['truckType'] = truckType;
      if (tripKmMin != null) params['tripKmMin'] = tripKmMin.toString();
      if (tripKmMax != null) params['tripKmMax'] = tripKmMax.toString();
      if (fullPartial != null) params['fullPartial'] = fullPartial;
      if (bookMode != null) params['bookMode'] = bookMode;
      if (rateMin != null) params['rateMin'] = rateMin.toString();
      if (rateMax != null) params['rateMax'] = rateMax.toString();
      if (sortBy != null) params['sortBy'] = sortBy;
      if (sortOrder != null) params['sortOrder'] = sortOrder;
      if (myLoads == true) params['myLoads'] = 'true';
      if (myTrips == true) params['myTrips'] = 'true';

      final response = await _apiClient.dio.get(
        '/api/loads',
        queryParameters: params,
      );

      if (response.statusCode == 200) {
        final loads = (response.data['loads'] as List)
            .map((json) => Load.fromJson(json))
            .toList();
        final pagination = response.data['pagination'] ?? {};

        return ApiResponse.success(LoadSearchResult(
          loads: loads,
          page: pagination['page'] ?? page,
          limit: pagination['limit'] ?? limit,
          total: pagination['total'] ?? loads.length,
          pages: pagination['pages'] ?? 1,
        ));
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to search loads',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred: $e');
    }
  }

  /// Get a single load by ID
  Future<ApiResponse<Load>> getLoadById(String id) async {
    try {
      final response = await _apiClient.dio.get('/api/loads/$id');

      if (response.statusCode == 200) {
        // API returns { load: {...} }
        final loadData = response.data['load'] ?? response.data;
        final load = Load.fromJson(loadData);
        return ApiResponse.success(load);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Load not found',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred: $e');
    }
  }

  /// Create a new load (for shippers)
  Future<ApiResponse<Load>> createLoad({
    required String pickupCity,
    required String deliveryCity,
    required DateTime pickupDate,
    required DateTime deliveryDate,
    required String truckType,
    required double weight,
    required String cargoDescription,
    String? pickupAddress,
    String? deliveryAddress,
    String? pickupDockHours,
    String? deliveryDockHours,
    double? volume,
    double? lengthM,
    double? tripKm,
    String fullPartial = 'FULL',
    bool isFragile = false,
    bool requiresRefrigeration = false,
    double? baseFareEtb,
    double? perKmEtb,
    double? rate,
    bool isAnonymous = false,
    String? shipperContactName,
    String? shipperContactPhone,
    String? safetyNotes,
    String? specialInstructions,
    String status = 'DRAFT',
  }) async {
    try {
      final data = <String, dynamic>{
        'pickupCity': pickupCity,
        'deliveryCity': deliveryCity,
        'pickupDate': pickupDate.toIso8601String(),
        'deliveryDate': deliveryDate.toIso8601String(),
        'truckType': truckType,
        'weight': weight,
        'cargoDescription': cargoDescription,
        'fullPartial': fullPartial,
        'isFragile': isFragile,
        'requiresRefrigeration': requiresRefrigeration,
        'isAnonymous': isAnonymous,
        'status': status,
      };

      if (pickupAddress != null) data['pickupAddress'] = pickupAddress;
      if (deliveryAddress != null) data['deliveryAddress'] = deliveryAddress;
      if (pickupDockHours != null) data['pickupDockHours'] = pickupDockHours;
      if (deliveryDockHours != null) data['deliveryDockHours'] = deliveryDockHours;
      if (volume != null) data['volume'] = volume;
      if (lengthM != null) data['lengthM'] = lengthM;
      if (tripKm != null) data['tripKm'] = tripKm;
      if (baseFareEtb != null) data['baseFareEtb'] = baseFareEtb;
      if (perKmEtb != null) data['perKmEtb'] = perKmEtb;
      if (rate != null) data['rate'] = rate;
      if (shipperContactName != null) data['shipperContactName'] = shipperContactName;
      if (shipperContactPhone != null) data['shipperContactPhone'] = shipperContactPhone;
      if (safetyNotes != null) data['safetyNotes'] = safetyNotes;
      if (specialInstructions != null) data['specialInstructions'] = specialInstructions;

      // Pricing is optional - shippers and carriers agree outside the platform

      final response = await _apiClient.dio.post('/api/loads', data: data);

      if (response.statusCode == 201) {
        // API returns { load: {...} }
        final loadData = response.data['load'] ?? response.data;
        final load = Load.fromJson(loadData);
        return ApiResponse.success(load);
      }

      // Handle validation errors with details
      String errorMsg = response.data['error'] ?? 'Failed to create load';
      if (response.data['details'] != null) {
        final details = response.data['details'] as List;
        if (details.isNotEmpty) {
          final firstError = details.first;
          errorMsg = '${firstError['path']?.join('.') ?? 'Field'}: ${firstError['message'] ?? errorMsg}';
        }
      }

      return ApiResponse.error(
        errorMsg,
        statusCode: response.statusCode,
      );
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

  /// Update a load
  Future<ApiResponse<Load>> updateLoad({
    required String id,
    String? status,
    String? pickupCity,
    String? deliveryCity,
    DateTime? pickupDate,
    DateTime? deliveryDate,
    String? truckType,
    double? weight,
    String? cargoDescription,
  }) async {
    try {
      final data = <String, dynamic>{};
      if (status != null) data['status'] = status;
      if (pickupCity != null) data['pickupCity'] = pickupCity;
      if (deliveryCity != null) data['deliveryCity'] = deliveryCity;
      if (pickupDate != null) data['pickupDate'] = pickupDate.toIso8601String();
      if (deliveryDate != null) data['deliveryDate'] = deliveryDate.toIso8601String();
      if (truckType != null) data['truckType'] = truckType;
      if (weight != null) data['weight'] = weight;
      if (cargoDescription != null) data['cargoDescription'] = cargoDescription;

      final response = await _apiClient.dio.patch('/api/loads/$id', data: data);

      if (response.statusCode == 200) {
        final loadData = response.data['load'] ?? response.data;
        final load = Load.fromJson(loadData);
        return ApiResponse.success(load);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to update load',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Update load status with validation
  /// Uses LoadStateMachine to validate transitions before API call
  Future<ApiResponse<Load>> updateLoadStatus({
    required String loadId,
    required LoadStatus currentStatus,
    required LoadStatus newStatus,
  }) async {
    // Client-side validation using LoadStateMachine
    if (!LoadStateMachine.canTransition(currentStatus, newStatus)) {
      final validStatuses = LoadStateMachine.getValidNextStatuses(currentStatus)
          .map((s) => s.name)
          .join(', ');
      return ApiResponse.error(
        'Invalid status transition from ${currentStatus.name} to ${newStatus.name}. '
        'Valid transitions: $validStatuses',
      );
    }

    return updateLoad(
      id: loadId,
      status: loadStatusToString(newStatus),
    );
  }

  /// Post a load (change status from DRAFT to POSTED)
  Future<ApiResponse<Load>> postLoad(String loadId) async {
    return updateLoad(id: loadId, status: 'POSTED');
  }

  /// Unpost a load (change status from POSTED to UNPOSTED)
  Future<ApiResponse<Load>> unpostLoad(String loadId) async {
    return updateLoad(id: loadId, status: 'UNPOSTED');
  }

  /// Cancel a load
  Future<ApiResponse<Load>> cancelLoad(String loadId) async {
    return updateLoad(id: loadId, status: 'CANCELLED');
  }

  /// Request a load (carrier)
  Future<ApiResponse<LoadRequest>> requestLoad({
    required String loadId,
    required String truckId,
    String? notes,
    double? proposedRate,
    int expiresInHours = 24,
  }) async {
    try {
      final data = <String, dynamic>{
        'loadId': loadId,
        'truckId': truckId,
        'expiresInHours': expiresInHours,
      };
      if (notes != null && notes.isNotEmpty) data['notes'] = notes;
      if (proposedRate != null) data['proposedRate'] = proposedRate;

      final response = await _apiClient.dio.post('/api/load-requests', data: data);

      if (response.statusCode == 201) {
        final request = LoadRequest.fromJson(response.data['loadRequest']);
        return ApiResponse.success(request);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to request load',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Get load requests
  Future<ApiResponse<List<LoadRequest>>> getLoadRequests({
    String? status,
    String? loadId,
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
      if (loadId != null) params['loadId'] = loadId;
      if (truckId != null) params['truckId'] = truckId;

      final response = await _apiClient.dio.get(
        '/api/load-requests',
        queryParameters: params,
      );

      if (response.statusCode == 200) {
        final requests = (response.data['loadRequests'] as List)
            .map((json) => LoadRequest.fromJson(json))
            .toList();
        return ApiResponse.success(requests);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to load requests',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Respond to a load request (shipper approves/rejects carrier's request)
  /// ENFORCES: Only shippers can respond to load requests for their loads
  Future<ApiResponse<LoadRequest>> respondToRequest({
    required String requestId,
    required String action, // APPROVE or REJECT
    String? responseNotes,
  }) async {
    try {
      // FOUNDATION RULE CHECK: Only shippers can respond to load requests
      final role = await _getCurrentUserRole();
      try {
        assertCanRespondToTruckRequest(role); // Shippers respond to carrier requests
      } on FoundationRuleViolation catch (e) {
        return ApiResponse.error(e.message, statusCode: 403);
      }

      final data = <String, dynamic>{
        'action': action,
      };
      if (responseNotes != null) data['responseNotes'] = responseNotes;

      final response = await _apiClient.dio.post(
        '/api/load-requests/$requestId/respond',
        data: data,
      );

      if (response.statusCode == 200) {
        final request = LoadRequest.fromJson(response.data['request']);
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

/// Load search result with pagination
class LoadSearchResult {
  final List<Load> loads;
  final int page;
  final int limit;
  final int total;
  final int pages;

  LoadSearchResult({
    required this.loads,
    required this.page,
    required this.limit,
    required this.total,
    required this.pages,
  });

  bool get hasMore => page < pages;
}

/// Simple organization info for contact display
class LoadRequestOrganization {
  final String id;
  final String name;
  final String? phone;
  final String? email;

  LoadRequestOrganization({
    required this.id,
    required this.name,
    this.phone,
    this.email,
  });

  factory LoadRequestOrganization.fromJson(Map<String, dynamic> json) {
    return LoadRequestOrganization(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      phone: json['phone'] ?? json['contactPhone'],
      email: json['email'] ?? json['contactEmail'],
    );
  }
}

/// Load request model
class LoadRequest {
  final String id;
  final String status;
  final String loadId;
  final String truckId;
  final String carrierId;
  final String shipperId;
  final String? notes;
  final double? proposedRate;
  final String? responseNotes;
  final DateTime? expiresAt;
  final DateTime? respondedAt;
  final DateTime createdAt;
  final Load? load;
  final Truck? truck;
  final LoadRequestOrganization? shipper;
  final LoadRequestOrganization? carrier;

  LoadRequest({
    required this.id,
    required this.status,
    required this.loadId,
    required this.truckId,
    required this.carrierId,
    required this.shipperId,
    this.notes,
    this.proposedRate,
    this.responseNotes,
    this.expiresAt,
    this.respondedAt,
    required this.createdAt,
    this.load,
    this.truck,
    this.shipper,
    this.carrier,
  });

  factory LoadRequest.fromJson(Map<String, dynamic> json) {
    return LoadRequest(
      id: json['id'] ?? '',
      status: json['status'] ?? 'PENDING',
      loadId: json['loadId'] ?? '',
      truckId: json['truckId'] ?? '',
      carrierId: json['carrierId'] ?? '',
      shipperId: json['shipperId'] ?? '',
      notes: json['notes'],
      proposedRate: json['proposedRate']?.toDouble(),
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
      load: json['load'] != null ? Load.fromJson(json['load']) : null,
      truck: json['truck'] != null ? Truck.fromJson(json['truck']) : null,
      shipper: json['shipper'] != null
          ? LoadRequestOrganization.fromJson(json['shipper'])
          : null,
      carrier: json['carrier'] != null
          ? LoadRequestOrganization.fromJson(json['carrier'])
          : null,
    );
  }

  bool get isPending => status == 'PENDING';
  bool get isApproved => status == 'APPROVED';
  bool get isRejected => status == 'REJECTED';
  bool get isExpired => status == 'EXPIRED';
}
