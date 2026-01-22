import 'load.dart';
import 'truck.dart';
import 'user.dart';

/// Request status enum matching backend
enum RequestStatus {
  pending,
  approved,
  rejected,
  expired,
  cancelled,
}

/// Helper to parse request status from string
RequestStatus requestStatusFromString(String? value) {
  switch (value?.toUpperCase()) {
    case 'PENDING':
      return RequestStatus.pending;
    case 'APPROVED':
      return RequestStatus.approved;
    case 'REJECTED':
      return RequestStatus.rejected;
    case 'EXPIRED':
      return RequestStatus.expired;
    case 'CANCELLED':
      return RequestStatus.cancelled;
    default:
      return RequestStatus.pending;
  }
}

/// Helper to convert request status to string for API
String requestStatusToString(RequestStatus status) {
  switch (status) {
    case RequestStatus.pending:
      return 'PENDING';
    case RequestStatus.approved:
      return 'APPROVED';
    case RequestStatus.rejected:
      return 'REJECTED';
    case RequestStatus.expired:
      return 'EXPIRED';
    case RequestStatus.cancelled:
      return 'CANCELLED';
  }
}

/// TruckRequest - Shipper request for a carrier's truck
/// Used when shipper finds a truck posting and wants to book it
class TruckRequest {
  final String id;
  final RequestStatus status;

  // Relations
  final String loadId;
  final Load? load;
  final String truckId;
  final Truck? truck;
  final String shipperId;
  final Organization? shipper;
  final String requestedById;
  final String carrierId;
  final Organization? carrier;

  // Request Details
  final String? notes;
  final double? offeredRate;

  // Response
  final DateTime? respondedAt;
  final String? responseNotes;
  final String? respondedById;

  // Timestamps
  final DateTime expiresAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  TruckRequest({
    required this.id,
    required this.status,
    required this.loadId,
    this.load,
    required this.truckId,
    this.truck,
    required this.shipperId,
    this.shipper,
    required this.requestedById,
    required this.carrierId,
    this.carrier,
    this.notes,
    this.offeredRate,
    this.respondedAt,
    this.responseNotes,
    this.respondedById,
    required this.expiresAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory TruckRequest.fromJson(Map<String, dynamic> json) {
    double? parseDoubleOrNull(dynamic value) {
      if (value == null) return null;
      if (value is num) return value.toDouble();
      if (value is String) return double.tryParse(value);
      return null;
    }

    return TruckRequest(
      id: json['id'] ?? '',
      status: requestStatusFromString(json['status']),
      loadId: json['loadId'] ?? '',
      load: json['load'] != null ? Load.fromJson(json['load']) : null,
      truckId: json['truckId'] ?? '',
      truck: json['truck'] != null ? Truck.fromJson(json['truck']) : null,
      shipperId: json['shipperId'] ?? '',
      shipper: json['shipper'] != null
          ? Organization.fromJson(json['shipper'])
          : null,
      requestedById: json['requestedById'] ?? '',
      carrierId: json['carrierId'] ?? '',
      carrier: json['carrier'] != null
          ? Organization.fromJson(json['carrier'])
          : null,
      notes: json['notes'],
      offeredRate: parseDoubleOrNull(json['offeredRate']),
      respondedAt: json['respondedAt'] != null
          ? DateTime.parse(json['respondedAt'])
          : null,
      responseNotes: json['responseNotes'],
      respondedById: json['respondedById'],
      expiresAt: json['expiresAt'] != null
          ? DateTime.parse(json['expiresAt'])
          : DateTime.now().add(const Duration(hours: 24)),
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'])
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'status': requestStatusToString(status),
      'loadId': loadId,
      'truckId': truckId,
      'shipperId': shipperId,
      'requestedById': requestedById,
      'carrierId': carrierId,
      'notes': notes,
      'offeredRate': offeredRate,
      'respondedAt': respondedAt?.toIso8601String(),
      'responseNotes': responseNotes,
      'respondedById': respondedById,
      'expiresAt': expiresAt.toIso8601String(),
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  // Status helpers
  bool get isPending => status == RequestStatus.pending;
  bool get isApproved => status == RequestStatus.approved;
  bool get isRejected => status == RequestStatus.rejected;
  bool get isExpired => status == RequestStatus.expired;
  bool get isCancelled => status == RequestStatus.cancelled;
  bool get canRespond => status == RequestStatus.pending;
  bool get canCancel => status == RequestStatus.pending;

  String get statusDisplay {
    switch (status) {
      case RequestStatus.pending:
        return 'Pending';
      case RequestStatus.approved:
        return 'Approved';
      case RequestStatus.rejected:
        return 'Rejected';
      case RequestStatus.expired:
        return 'Expired';
      case RequestStatus.cancelled:
        return 'Cancelled';
    }
  }
}

/// LoadRequest - Carrier request for a shipper's load
/// Used when carrier finds a load posting and wants to haul it
class LoadRequest {
  final String id;
  final RequestStatus status;

  // Relations
  final String loadId;
  final Load? load;
  final String truckId;
  final Truck? truck;
  final String carrierId;
  final Organization? carrier;
  final String requestedById;
  final String shipperId;
  final Organization? shipper;

  // Request Details
  final String? notes;
  final double? proposedRate;

  // Response
  final DateTime? respondedAt;
  final String? responseNotes;
  final String? respondedById;

  // Timestamps
  final DateTime expiresAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  LoadRequest({
    required this.id,
    required this.status,
    required this.loadId,
    this.load,
    required this.truckId,
    this.truck,
    required this.carrierId,
    this.carrier,
    required this.requestedById,
    required this.shipperId,
    this.shipper,
    this.notes,
    this.proposedRate,
    this.respondedAt,
    this.responseNotes,
    this.respondedById,
    required this.expiresAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory LoadRequest.fromJson(Map<String, dynamic> json) {
    double? parseDoubleOrNull(dynamic value) {
      if (value == null) return null;
      if (value is num) return value.toDouble();
      if (value is String) return double.tryParse(value);
      return null;
    }

    return LoadRequest(
      id: json['id'] ?? '',
      status: requestStatusFromString(json['status']),
      loadId: json['loadId'] ?? '',
      load: json['load'] != null ? Load.fromJson(json['load']) : null,
      truckId: json['truckId'] ?? '',
      truck: json['truck'] != null ? Truck.fromJson(json['truck']) : null,
      carrierId: json['carrierId'] ?? '',
      carrier: json['carrier'] != null
          ? Organization.fromJson(json['carrier'])
          : null,
      requestedById: json['requestedById'] ?? '',
      shipperId: json['shipperId'] ?? '',
      shipper: json['shipper'] != null
          ? Organization.fromJson(json['shipper'])
          : null,
      notes: json['notes'],
      proposedRate: parseDoubleOrNull(json['proposedRate']),
      respondedAt: json['respondedAt'] != null
          ? DateTime.parse(json['respondedAt'])
          : null,
      responseNotes: json['responseNotes'],
      respondedById: json['respondedById'],
      expiresAt: json['expiresAt'] != null
          ? DateTime.parse(json['expiresAt'])
          : DateTime.now().add(const Duration(hours: 24)),
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'])
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'status': requestStatusToString(status),
      'loadId': loadId,
      'truckId': truckId,
      'carrierId': carrierId,
      'requestedById': requestedById,
      'shipperId': shipperId,
      'notes': notes,
      'proposedRate': proposedRate,
      'respondedAt': respondedAt?.toIso8601String(),
      'responseNotes': responseNotes,
      'respondedById': respondedById,
      'expiresAt': expiresAt.toIso8601String(),
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  // Status helpers
  bool get isPending => status == RequestStatus.pending;
  bool get isApproved => status == RequestStatus.approved;
  bool get isRejected => status == RequestStatus.rejected;
  bool get isExpired => status == RequestStatus.expired;
  bool get isCancelled => status == RequestStatus.cancelled;
  bool get canRespond => status == RequestStatus.pending;
  bool get canCancel => status == RequestStatus.pending;

  String get statusDisplay {
    switch (status) {
      case RequestStatus.pending:
        return 'Pending';
      case RequestStatus.approved:
        return 'Approved';
      case RequestStatus.rejected:
        return 'Rejected';
      case RequestStatus.expired:
        return 'Expired';
      case RequestStatus.cancelled:
        return 'Cancelled';
    }
  }
}
