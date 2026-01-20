import 'truck.dart';

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

  // Distance
  final double? tripKm;
  final double? estimatedTripKm;
  final double? dhToOriginKm;

  // Pricing
  final double? baseFareEtb;
  final double? perKmEtb;
  final double? totalFareEtb;
  final double? rate;

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

  // Relationships
  final String shipperId;
  final String? assignedTruckId;
  final Truck? assignedTruck;

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
    this.tripKm,
    this.estimatedTripKm,
    this.dhToOriginKm,
    this.baseFareEtb,
    this.perKmEtb,
    this.totalFareEtb,
    this.rate,
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
    required this.shipperId,
    this.assignedTruckId,
    this.assignedTruck,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Load.fromJson(Map<String, dynamic> json) {
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
      deliveryCity: json['deliveryCity'] ?? json['deliveryLocation']?['name'],
      deliveryCityId: json['deliveryCityId'],
      deliveryAddress: json['deliveryAddress'],
      deliveryDockHours: json['deliveryDockHours'],
      deliveryDate: json['deliveryDate'] != null
          ? DateTime.parse(json['deliveryDate'])
          : DateTime.now(),
      originLat: json['originLat']?.toDouble(),
      originLon: json['originLon']?.toDouble(),
      destinationLat: json['destinationLat']?.toDouble(),
      destinationLon: json['destinationLon']?.toDouble(),
      truckType: truckTypeFromString(json['truckType']),
      weight: (json['weight'] ?? 0).toDouble(),
      volume: json['volume']?.toDouble(),
      cargoDescription: json['cargoDescription'] ?? '',
      fullPartial: json['fullPartial'] == 'PARTIAL'
          ? LoadType.partial
          : LoadType.full,
      isFragile: json['isFragile'] ?? false,
      requiresRefrigeration: json['requiresRefrigeration'] ?? false,
      tripKm: json['tripKm']?.toDouble(),
      estimatedTripKm: json['estimatedTripKm']?.toDouble(),
      dhToOriginKm: json['dhToOriginKm']?.toDouble(),
      baseFareEtb: json['baseFareEtb']?.toDouble(),
      perKmEtb: json['perKmEtb']?.toDouble(),
      totalFareEtb: json['totalFareEtb']?.toDouble(),
      rate: json['rate']?.toDouble(),
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
      shipperId: json['shipperId'] ?? '',
      assignedTruckId: json['assignedTruckId'],
      assignedTruck: json['assignedTruck'] != null
          ? Truck.fromJson(json['assignedTruck'])
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
