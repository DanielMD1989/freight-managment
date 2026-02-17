import 'truck.dart';
import '../utils/parse_utils.dart';

/// Load status matching the web app's LoadStatus enum
enum LoadStatus {
  draft,
  posted,
  searching,
  offered,
  assigned,
  pickupPending,
  inTransit,
  delivered,
  completed,
  exception,
  cancelled,
  expired,
  unposted,
}

/// Load type
enum LoadType {
  full,
  partial,
}

/// Helper to parse load status from string
LoadStatus loadStatusFromString(String? value) {
  switch (value?.toUpperCase()) {
    case 'DRAFT':
      return LoadStatus.draft;
    case 'POSTED':
      return LoadStatus.posted;
    case 'SEARCHING':
      return LoadStatus.searching;
    case 'OFFERED':
      return LoadStatus.offered;
    case 'ASSIGNED':
      return LoadStatus.assigned;
    case 'PICKUP_PENDING':
      return LoadStatus.pickupPending;
    case 'IN_TRANSIT':
      return LoadStatus.inTransit;
    case 'DELIVERED':
      return LoadStatus.delivered;
    case 'COMPLETED':
      return LoadStatus.completed;
    case 'EXCEPTION':
      return LoadStatus.exception;
    case 'CANCELLED':
      return LoadStatus.cancelled;
    case 'EXPIRED':
      return LoadStatus.expired;
    case 'UNPOSTED':
      return LoadStatus.unposted;
    default:
      return LoadStatus.draft;
  }
}

/// Helper to convert load status to string for API
String loadStatusToString(LoadStatus status) {
  switch (status) {
    case LoadStatus.draft:
      return 'DRAFT';
    case LoadStatus.posted:
      return 'POSTED';
    case LoadStatus.searching:
      return 'SEARCHING';
    case LoadStatus.offered:
      return 'OFFERED';
    case LoadStatus.assigned:
      return 'ASSIGNED';
    case LoadStatus.pickupPending:
      return 'PICKUP_PENDING';
    case LoadStatus.inTransit:
      return 'IN_TRANSIT';
    case LoadStatus.delivered:
      return 'DELIVERED';
    case LoadStatus.completed:
      return 'COMPLETED';
    case LoadStatus.exception:
      return 'EXCEPTION';
    case LoadStatus.cancelled:
      return 'CANCELLED';
    case LoadStatus.expired:
      return 'EXPIRED';
    case LoadStatus.unposted:
      return 'UNPOSTED';
  }
}

/// Service fee status - matches Prisma ServiceFeeStatus enum
enum ServiceFeeStatus {
  pending,   // PENDING - Not yet calculated/reserved
  reserved,  // RESERVED - Held from wallet when trip starts
  deducted,  // DEDUCTED - Moved to platform revenue on completion
  refunded,  // REFUNDED - Returned to shipper on cancellation
  waived,    // WAIVED - Admin waived the fee
}

ServiceFeeStatus serviceFeeStatusFromString(String? value) {
  switch (value?.toUpperCase()) {
    case 'PENDING':
      return ServiceFeeStatus.pending;
    case 'RESERVED':
      return ServiceFeeStatus.reserved;
    case 'DEDUCTED':
      return ServiceFeeStatus.deducted;
    case 'REFUNDED':
      return ServiceFeeStatus.refunded;
    case 'WAIVED':
      return ServiceFeeStatus.waived;
    default:
      return ServiceFeeStatus.pending;
  }
}

/// Book mode matching Prisma BookMode enum
/// - REQUEST: Shipper requests truck, carrier must approve
/// - INSTANT: Immediate booking, no approval needed
enum BookMode {
  request,
  instant,
}

extension BookModeExtension on BookMode {
  /// Get the API value (SCREAMING_CASE)
  String get value {
    switch (this) {
      case BookMode.request:
        return 'REQUEST';
      case BookMode.instant:
        return 'INSTANT';
    }
  }

  /// Get display name for UI
  String get displayName {
    switch (this) {
      case BookMode.request:
        return 'Request';
      case BookMode.instant:
        return 'Instant';
    }
  }

  /// Parse from API string
  static BookMode fromString(String? value) {
    switch (value?.toUpperCase()) {
      case 'INSTANT':
        return BookMode.instant;
      case 'REQUEST':
      default:
        return BookMode.request;
    }
  }
}

/// Helper function for backward compatibility
BookMode bookModeFromString(String? value) {
  return BookModeExtension.fromString(value);
}

/// Load model matching the web app's Load type
class Load {
  final String id;
  final LoadStatus status;
  final DateTime? postedAt;

  // Location & Schedule
  final String? pickupCity;
  final String? pickupCityId;
  final String? pickupAddress;
  final String? pickupDockHours;
  final DateTime pickupDate;
  final bool appointmentRequired;
  final String? deliveryCity;
  final String? deliveryCityId;
  final String? deliveryAddress;
  final String? deliveryDockHours;
  final DateTime deliveryDate;

  // Coordinates
  final double? originLat;
  final double? originLon;
  final double? destinationLat;
  final double? destinationLon;

  // Load Details
  final TruckType truckType;
  final double weight; // in kg
  final double? volume;
  final String cargoDescription;
  final LoadType fullPartial;
  final bool isFragile;
  final bool requiresRefrigeration;
  final double? lengthM;
  final int? casesCount;

  // Distance
  final double? tripKm;
  final double? estimatedTripKm;
  final double? dhToOriginKm;
  final double? dhAfterDeliveryKm;
  final double? actualTripKm;

  // Pricing
  final double? baseFareEtb;
  final double? perKmEtb;
  final double? totalFareEtb;
  final double? rate;
  final String currency;
  final BookMode bookMode;

  // Service Fees (HIGH priority missing fields)
  final double? serviceFeeEtb;
  final double? shipperServiceFee;
  final ServiceFeeStatus shipperFeeStatus;
  final double? carrierServiceFee;
  final ServiceFeeStatus carrierFeeStatus;
  final String? corridorId;

  // Escrow & Commissions
  final bool escrowFunded;
  final double? escrowAmount;
  final double? shipperCommission;
  final double? carrierCommission;
  final double? platformCommission;
  final String? settlementStatus;
  final DateTime? settledAt;

  // Privacy & Safety
  final bool isAnonymous;
  final String? shipperContactName;
  final String? shipperContactPhone;
  final String? safetyNotes;
  final String? specialInstructions;

  // POD
  final String? podUrl;
  final bool podSubmitted;
  final DateTime? podSubmittedAt;
  final bool podVerified;
  final DateTime? podVerifiedAt;

  // Tracking (HIGH priority missing fields)
  final String? trackingUrl;
  final bool trackingEnabled;
  final DateTime? trackingStartedAt;

  // Trip Progress
  final int tripProgressPercent;
  final double? remainingDistanceKm;

  // Relationships
  final String shipperId;
  final String? shipperName;
  final bool shipperIsVerified;
  final String? createdById;
  final String? assignedTruckId;
  final Truck? assignedTruck;
  final DateTime? assignedAt;
  final DateTime? expiresAt;

  final DateTime createdAt;
  final DateTime updatedAt;

  Load({
    required this.id,
    required this.status,
    this.postedAt,
    this.pickupCity,
    this.pickupCityId,
    this.pickupAddress,
    this.pickupDockHours,
    required this.pickupDate,
    this.appointmentRequired = false,
    this.deliveryCity,
    this.deliveryCityId,
    this.deliveryAddress,
    this.deliveryDockHours,
    required this.deliveryDate,
    this.originLat,
    this.originLon,
    this.destinationLat,
    this.destinationLon,
    required this.truckType,
    required this.weight,
    this.volume,
    required this.cargoDescription,
    this.fullPartial = LoadType.full,
    this.isFragile = false,
    this.requiresRefrigeration = false,
    this.lengthM,
    this.casesCount,
    this.tripKm,
    this.estimatedTripKm,
    this.dhToOriginKm,
    this.dhAfterDeliveryKm,
    this.actualTripKm,
    this.baseFareEtb,
    this.perKmEtb,
    this.totalFareEtb,
    this.rate,
    this.currency = 'ETB',
    this.bookMode = BookMode.request,
    this.serviceFeeEtb,
    this.shipperServiceFee,
    this.shipperFeeStatus = ServiceFeeStatus.pending,
    this.carrierServiceFee,
    this.carrierFeeStatus = ServiceFeeStatus.pending,
    this.corridorId,
    this.escrowFunded = false,
    this.escrowAmount,
    this.shipperCommission,
    this.carrierCommission,
    this.platformCommission,
    this.settlementStatus,
    this.settledAt,
    this.isAnonymous = false,
    this.shipperContactName,
    this.shipperContactPhone,
    this.safetyNotes,
    this.specialInstructions,
    this.podUrl,
    this.podSubmitted = false,
    this.podSubmittedAt,
    this.podVerified = false,
    this.podVerifiedAt,
    this.trackingUrl,
    this.trackingEnabled = false,
    this.trackingStartedAt,
    this.tripProgressPercent = 0,
    this.remainingDistanceKm,
    required this.shipperId,
    this.shipperName,
    this.shipperIsVerified = false,
    this.createdById,
    this.assignedTruckId,
    this.assignedTruck,
    this.assignedAt,
    this.expiresAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Load.fromJson(Map<String, dynamic> json) {
    int? parseIntOrNull(dynamic value) {
      if (value == null) return null;
      if (value is int) return value;
      if (value is num) return value.toInt();
      if (value is String) return int.tryParse(value);
      return null;
    }

    int parseInt(dynamic value, [int defaultValue = 0]) {
      return parseIntOrNull(value) ?? defaultValue;
    }

    return Load(
      id: json['id'] ?? '',
      status: loadStatusFromString(json['status']),
      postedAt:
          json['postedAt'] != null ? DateTime.parse(json['postedAt']) : null,
      pickupCity: json['pickupCity'] ?? json['pickupLocation']?['name'],
      pickupCityId: json['pickupCityId'],
      pickupAddress: json['pickupAddress'],
      pickupDockHours: json['pickupDockHours'],
      pickupDate: json['pickupDate'] != null
          ? DateTime.parse(json['pickupDate'])
          : DateTime.now(),
      appointmentRequired: json['appointmentRequired'] ?? false,
      deliveryCity: json['deliveryCity'] ?? json['deliveryLocation']?['name'],
      deliveryCityId: json['deliveryCityId'],
      deliveryAddress: json['deliveryAddress'],
      deliveryDockHours: json['deliveryDockHours'],
      deliveryDate: json['deliveryDate'] != null
          ? DateTime.parse(json['deliveryDate'])
          : DateTime.now(),
      originLat: parseDoubleOrNull(json['originLat']),
      originLon: parseDoubleOrNull(json['originLon']),
      destinationLat: parseDoubleOrNull(json['destinationLat']),
      destinationLon: parseDoubleOrNull(json['destinationLon']),
      truckType: truckTypeFromString(json['truckType']),
      weight: parseDoubleOrDefault(json['weight'], 0),
      volume: parseDoubleOrNull(json['volume']),
      cargoDescription: json['cargoDescription'] ?? '',
      fullPartial: json['fullPartial'] == 'PARTIAL'
          ? LoadType.partial
          : LoadType.full,
      isFragile: json['isFragile'] ?? false,
      requiresRefrigeration: json['requiresRefrigeration'] ?? false,
      lengthM: parseDoubleOrNull(json['lengthM']),
      casesCount: parseIntOrNull(json['casesCount']),
      tripKm: parseDoubleOrNull(json['tripKm']),
      estimatedTripKm: parseDoubleOrNull(json['estimatedTripKm']),
      dhToOriginKm: parseDoubleOrNull(json['dhToOriginKm']),
      dhAfterDeliveryKm: parseDoubleOrNull(json['dhAfterDeliveryKm']),
      actualTripKm: parseDoubleOrNull(json['actualTripKm']),
      baseFareEtb: parseDoubleOrNull(json['baseFareEtb']),
      perKmEtb: parseDoubleOrNull(json['perKmEtb']),
      totalFareEtb: parseDoubleOrNull(json['totalFareEtb']),
      rate: parseDoubleOrNull(json['rate']),
      currency: json['currency'] ?? 'ETB',
      bookMode: bookModeFromString(json['bookMode']),
      serviceFeeEtb: parseDoubleOrNull(json['serviceFeeEtb']),
      shipperServiceFee: parseDoubleOrNull(json['shipperServiceFee']),
      shipperFeeStatus: serviceFeeStatusFromString(json['shipperFeeStatus']),
      carrierServiceFee: parseDoubleOrNull(json['carrierServiceFee']),
      carrierFeeStatus: serviceFeeStatusFromString(json['carrierFeeStatus']),
      corridorId: json['corridorId'],
      escrowFunded: json['escrowFunded'] ?? false,
      escrowAmount: parseDoubleOrNull(json['escrowAmount']),
      shipperCommission: parseDoubleOrNull(json['shipperCommission']),
      carrierCommission: parseDoubleOrNull(json['carrierCommission']),
      platformCommission: parseDoubleOrNull(json['platformCommission']),
      settlementStatus: json['settlementStatus'],
      settledAt: json['settledAt'] != null
          ? DateTime.parse(json['settledAt'])
          : null,
      isAnonymous: json['isAnonymous'] ?? false,
      shipperContactName: json['shipperContactName'],
      shipperContactPhone: json['shipperContactPhone'],
      safetyNotes: json['safetyNotes'],
      specialInstructions: json['specialInstructions'],
      podUrl: json['podUrl'],
      podSubmitted: json['podSubmitted'] ?? false,
      podSubmittedAt: json['podSubmittedAt'] != null
          ? DateTime.parse(json['podSubmittedAt'])
          : null,
      podVerified: json['podVerified'] ?? false,
      podVerifiedAt: json['podVerifiedAt'] != null
          ? DateTime.parse(json['podVerifiedAt'])
          : null,
      trackingUrl: json['trackingUrl'],
      trackingEnabled: json['trackingEnabled'] ?? false,
      trackingStartedAt: json['trackingStartedAt'] != null
          ? DateTime.parse(json['trackingStartedAt'])
          : null,
      tripProgressPercent: parseInt(json['tripProgressPercent']),
      remainingDistanceKm: parseDoubleOrNull(json['remainingDistanceKm']),
      shipperId: json['shipperId'] ?? '',
      shipperName: json['shipper'] is Map ? json['shipper']['name'] : null,
      shipperIsVerified: json['shipper'] is Map ? (json['shipper']['isVerified'] ?? false) : false,
      createdById: json['createdById'],
      assignedTruckId: json['assignedTruckId'],
      assignedTruck: json['assignedTruck'] != null
          ? Truck.fromJson(json['assignedTruck'])
          : null,
      assignedAt: json['assignedAt'] != null
          ? DateTime.parse(json['assignedAt'])
          : null,
      expiresAt: json['expiresAt'] != null
          ? DateTime.parse(json['expiresAt'])
          : null,
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
      'pickupCity': pickupCity,
      'pickupCityId': pickupCityId,
      'pickupAddress': pickupAddress,
      'pickupDockHours': pickupDockHours,
      'pickupDate': pickupDate.toIso8601String(),
      'deliveryCity': deliveryCity,
      'deliveryCityId': deliveryCityId,
      'deliveryAddress': deliveryAddress,
      'deliveryDockHours': deliveryDockHours,
      'deliveryDate': deliveryDate.toIso8601String(),
      'truckType': truckTypeToString(truckType),
      'weight': weight,
      if (volume != null) 'volume': volume,
      'cargoDescription': cargoDescription,
      'fullPartial': fullPartial == LoadType.partial ? 'PARTIAL' : 'FULL',
      'isFragile': isFragile,
      'requiresRefrigeration': requiresRefrigeration,
      if (baseFareEtb != null) 'baseFareEtb': baseFareEtb,
      if (perKmEtb != null) 'perKmEtb': perKmEtb,
      'isAnonymous': isAnonymous,
      if (safetyNotes != null) 'safetyNotes': safetyNotes,
      if (specialInstructions != null)
        'specialInstructions': specialInstructions,
    };
  }

  // Display helpers
  String get route => '$pickupCity → $deliveryCity';
  String get routeDisplay => route;

  String get statusDisplay {
    switch (status) {
      case LoadStatus.draft:
        return 'Draft';
      case LoadStatus.posted:
        return 'Posted';
      case LoadStatus.searching:
        return 'Searching';
      case LoadStatus.offered:
        return 'Offered';
      case LoadStatus.assigned:
        return 'Assigned';
      case LoadStatus.pickupPending:
        return 'Pickup Pending';
      case LoadStatus.inTransit:
        return 'In Transit';
      case LoadStatus.delivered:
        return 'Delivered';
      case LoadStatus.completed:
        return 'Completed';
      case LoadStatus.exception:
        return 'Exception';
      case LoadStatus.cancelled:
        return 'Cancelled';
      case LoadStatus.expired:
        return 'Expired';
      case LoadStatus.unposted:
        return 'Unposted';
    }
  }

  String get weightDisplay => '${(weight / 1000).toStringAsFixed(1)} tons';

  String get truckTypeDisplay {
    switch (truckType) {
      case TruckType.flatbed:
        return 'Flatbed';
      case TruckType.refrigerated:
        return 'Refrigerated';
      case TruckType.tanker:
        return 'Tanker';
      case TruckType.container:
        return 'Container';
      case TruckType.dryVan:
        return 'Dry Van';
      case TruckType.lowboy:
        return 'Lowboy';
      case TruckType.dumpTruck:
        return 'Dump Truck';
      case TruckType.boxTruck:
        return 'Box Truck';
    }
  }

  String get distanceDisplay {
    final km = estimatedTripKm ?? tripKm;
    return km != null ? '${km.toStringAsFixed(0)} km' : 'N/A';
  }

  bool get isActive =>
      status == LoadStatus.posted ||
      status == LoadStatus.searching ||
      status == LoadStatus.offered;

  bool get isAssigned =>
      status == LoadStatus.assigned ||
      status == LoadStatus.pickupPending ||
      status == LoadStatus.inTransit;

  bool get isCompleted =>
      status == LoadStatus.delivered || status == LoadStatus.completed;

  bool get canUploadPod => status == LoadStatus.delivered;

  bool get needsAttention => status == LoadStatus.exception;
}
