/// Truck types matching the web app's TruckType enum
enum TruckType {
  flatbed,
  refrigerated,
  tanker,
  container,
  dryVan,
  lowboy,
  dumpTruck,
  boxTruck,
}

/// GPS device status
enum GpsDeviceStatus {
  active,
  inactive,
  signalLost,
  maintenance,
}

/// Verification status
enum VerificationStatus {
  pending,
  approved,
  rejected,
  expired,
}

/// Helper to parse truck type from string
TruckType truckTypeFromString(String? value) {
  switch (value?.toUpperCase()) {
    case 'FLATBED':
      return TruckType.flatbed;
    case 'REFRIGERATED':
      return TruckType.refrigerated;
    case 'TANKER':
      return TruckType.tanker;
    case 'CONTAINER':
      return TruckType.container;
    case 'DRY_VAN':
      return TruckType.dryVan;
    case 'LOWBOY':
      return TruckType.lowboy;
    case 'DUMP_TRUCK':
      return TruckType.dumpTruck;
    case 'BOX_TRUCK':
      return TruckType.boxTruck;
    default:
      return TruckType.flatbed;
  }
}

/// Helper to convert truck type to string for API
String truckTypeToString(TruckType type) {
  switch (type) {
    case TruckType.flatbed:
      return 'FLATBED';
    case TruckType.refrigerated:
      return 'REFRIGERATED';
    case TruckType.tanker:
      return 'TANKER';
    case TruckType.container:
      return 'CONTAINER';
    case TruckType.dryVan:
      return 'DRY_VAN';
    case TruckType.lowboy:
      return 'LOWBOY';
    case TruckType.dumpTruck:
      return 'DUMP_TRUCK';
    case TruckType.boxTruck:
      return 'BOX_TRUCK';
  }
}

/// Helper to parse GPS status from string
GpsDeviceStatus? gpsStatusFromString(String? value) {
  if (value == null) return null;
  switch (value.toUpperCase()) {
    case 'ACTIVE':
      return GpsDeviceStatus.active;
    case 'INACTIVE':
      return GpsDeviceStatus.inactive;
    case 'SIGNAL_LOST':
      return GpsDeviceStatus.signalLost;
    case 'MAINTENANCE':
      return GpsDeviceStatus.maintenance;
    default:
      return null;
  }
}

/// Helper to parse verification status from string
VerificationStatus verificationStatusFromString(String? value) {
  switch (value?.toUpperCase()) {
    case 'APPROVED':
      return VerificationStatus.approved;
    case 'REJECTED':
      return VerificationStatus.rejected;
    case 'EXPIRED':
      return VerificationStatus.expired;
    default:
      return VerificationStatus.pending;
  }
}

/// Truck model matching the web app's Truck type
class Truck {
  final String id;
  final TruckType truckType;
  final String licensePlate;
  final double capacity; // in kg
  final double? volume; // in cubic meters
  final bool isAvailable;
  final String? currentCity;
  final String? currentRegion;
  final double? currentLocationLat;
  final double? currentLocationLon;
  final DateTime? locationUpdatedAt;
  final String? imei;
  final String? gpsProvider;
  final GpsDeviceStatus? gpsStatus;
  final DateTime? gpsLastSeenAt;
  final VerificationStatus approvalStatus;
  final String? rejectionReason;
  final String carrierId;
  final String? ownerName;
  final String? contactName;
  final String? contactPhone;
  final double? lengthM;
  final DateTime createdAt;
  final DateTime updatedAt;

  Truck({
    required this.id,
    required this.truckType,
    required this.licensePlate,
    required this.capacity,
    this.volume,
    required this.isAvailable,
    this.currentCity,
    this.currentRegion,
    this.currentLocationLat,
    this.currentLocationLon,
    this.locationUpdatedAt,
    this.imei,
    this.gpsProvider,
    this.gpsStatus,
    this.gpsLastSeenAt,
    required this.approvalStatus,
    this.rejectionReason,
    required this.carrierId,
    this.ownerName,
    this.contactName,
    this.contactPhone,
    this.lengthM,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Truck.fromJson(Map<String, dynamic> json) {
    // Helper to parse number from string or number
    double parseDouble(dynamic value, [double defaultValue = 0]) {
      if (value == null) return defaultValue;
      if (value is num) return value.toDouble();
      if (value is String) return double.tryParse(value) ?? defaultValue;
      return defaultValue;
    }

    return Truck(
      id: json['id'] ?? '',
      truckType: truckTypeFromString(json['truckType']),
      licensePlate: json['licensePlate'] ?? '',
      capacity: parseDouble(json['capacity']),
      volume: json['volume'] != null ? parseDouble(json['volume']) : null,
      isAvailable: json['isAvailable'] ?? true,
      currentCity: json['currentCity'],
      currentRegion: json['currentRegion'],
      currentLocationLat: json['currentLocationLat'] != null ? parseDouble(json['currentLocationLat']) : null,
      currentLocationLon: json['currentLocationLon'] != null ? parseDouble(json['currentLocationLon']) : null,
      locationUpdatedAt: json['locationUpdatedAt'] != null
          ? DateTime.parse(json['locationUpdatedAt'])
          : null,
      imei: json['imei'],
      gpsProvider: json['gpsProvider'],
      gpsStatus: gpsStatusFromString(json['gpsStatus']),
      gpsLastSeenAt: json['gpsLastSeenAt'] != null
          ? DateTime.parse(json['gpsLastSeenAt'])
          : null,
      approvalStatus: verificationStatusFromString(json['approvalStatus']),
      rejectionReason: json['rejectionReason'],
      carrierId: json['carrierId'] ?? '',
      ownerName: json['ownerName'],
      contactName: json['contactName'],
      contactPhone: json['contactPhone'],
      lengthM: json['lengthM'] != null ? parseDouble(json['lengthM']) : null,
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
      'truckType': truckTypeToString(truckType),
      'licensePlate': licensePlate,
      'capacity': capacity,
      if (volume != null) 'volume': volume,
      'isAvailable': isAvailable,
      if (currentCity != null) 'currentCity': currentCity,
      if (currentRegion != null) 'currentRegion': currentRegion,
      if (currentLocationLat != null) 'currentLocationLat': currentLocationLat,
      if (currentLocationLon != null) 'currentLocationLon': currentLocationLon,
      if (imei != null) 'imei': imei,
      if (gpsProvider != null) 'gpsProvider': gpsProvider,
      'carrierId': carrierId,
      if (ownerName != null) 'ownerName': ownerName,
      if (contactName != null) 'contactName': contactName,
      if (contactPhone != null) 'contactPhone': contactPhone,
      if (lengthM != null) 'lengthM': lengthM,
    };
  }

  bool get hasGps => imei != null && imei!.isNotEmpty;
  bool get isGpsActive => gpsStatus == GpsDeviceStatus.active;
  bool get isApproved => approvalStatus == VerificationStatus.approved;
  bool get isPending => approvalStatus == VerificationStatus.pending;
  bool get isRejected => approvalStatus == VerificationStatus.rejected;

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

  String get statusDisplay {
    if (!isApproved) {
      if (isPending) return 'Pending Approval';
      if (isRejected) return 'Rejected';
      return 'Not Approved';
    }
    return isAvailable ? 'Available' : 'On Job';
  }

  String get capacityDisplay => '${(capacity / 1000).toStringAsFixed(1)} tons';
}

/// Truck posting for loadboard
class TruckPosting {
  final String id;
  final String truckId;
  final Truck? truck;
  final String status;
  final String? originCityId;
  final String? destinationCityId;
  final String? originCityName;
  final String? destinationCityName;
  final DateTime availableFrom;
  final DateTime? availableTo;
  final String? fullPartial;
  final double? availableLength;
  final double? availableWeight;
  final String? notes;
  final String? contactName;
  final String? contactPhone;
  final String? ownerName;
  final String carrierId;
  final DateTime createdAt;

  TruckPosting({
    required this.id,
    required this.truckId,
    this.truck,
    required this.status,
    this.originCityId,
    this.destinationCityId,
    this.originCityName,
    this.destinationCityName,
    required this.availableFrom,
    this.availableTo,
    this.fullPartial,
    this.availableLength,
    this.availableWeight,
    this.notes,
    this.contactName,
    this.contactPhone,
    this.ownerName,
    required this.carrierId,
    required this.createdAt,
  });

  factory TruckPosting.fromJson(Map<String, dynamic> json) {
    return TruckPosting(
      id: json['id'] ?? '',
      truckId: json['truckId'] ?? '',
      truck: json['truck'] != null ? Truck.fromJson(json['truck']) : null,
      status: json['status'] ?? 'ACTIVE',
      originCityId: json['originCityId'],
      destinationCityId: json['destinationCityId'],
      originCityName: json['originCity']?['name'] ?? json['originCityName'],
      destinationCityName: json['destinationCity']?['name'] ?? json['destinationCityName'],
      availableFrom: json['availableFrom'] != null
          ? DateTime.parse(json['availableFrom'])
          : DateTime.now(),
      availableTo: json['availableTo'] != null
          ? DateTime.parse(json['availableTo'])
          : null,
      fullPartial: json['fullPartial'],
      availableLength: json['availableLength'] != null
          ? (json['availableLength'] is num
              ? json['availableLength'].toDouble()
              : double.tryParse(json['availableLength'].toString()))
          : null,
      availableWeight: json['availableWeight'] != null
          ? (json['availableWeight'] is num
              ? json['availableWeight'].toDouble()
              : double.tryParse(json['availableWeight'].toString()))
          : null,
      notes: json['notes'],
      contactName: json['contactName'],
      contactPhone: json['contactPhone'],
      ownerName: json['ownerName'],
      carrierId: json['carrierId'] ?? '',
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }

  bool get isActive => status == 'ACTIVE';
}
