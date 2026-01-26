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
  // P1-003 FIX: Added GPS tracking fields for web-mobile parity
  final double? lastLatitude;      // Latest GPS latitude
  final double? lastLongitude;     // Latest GPS longitude
  final double? heading;           // Direction of travel (0-360 degrees)
  final double? speed;             // Current speed in km/h
  final DateTime? gpsUpdatedAt;    // When GPS position was last updated
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
    // P1-003 FIX: GPS tracking fields
    this.lastLatitude,
    this.lastLongitude,
    this.heading,
    this.speed,
    this.gpsUpdatedAt,
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
      // P1-003 FIX: Parse GPS tracking fields
      lastLatitude: json['lastLatitude'] != null ? parseDouble(json['lastLatitude']) : null,
      lastLongitude: json['lastLongitude'] != null ? parseDouble(json['lastLongitude']) : null,
      heading: json['heading'] != null ? parseDouble(json['heading']) : null,
      speed: json['speed'] != null ? parseDouble(json['speed']) : null,
      gpsUpdatedAt: json['gpsUpdatedAt'] != null
          ? DateTime.parse(json['gpsUpdatedAt'])
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
      // P1-003 FIX: Include GPS tracking fields
      if (lastLatitude != null) 'lastLatitude': lastLatitude,
      if (lastLongitude != null) 'lastLongitude': lastLongitude,
      if (heading != null) 'heading': heading,
      if (speed != null) 'speed': speed,
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

  // P1-003 FIX: GPS tracking helpers
  bool get hasGpsLocation => lastLatitude != null && lastLongitude != null;

  /// Get current GPS position (prefers lastLatitude/Longitude, fallback to currentLocation)
  (double lat, double lng)? get gpsPosition {
    if (lastLatitude != null && lastLongitude != null) {
      return (lastLatitude!, lastLongitude!);
    }
    if (currentLocationLat != null && currentLocationLon != null) {
      return (currentLocationLat!, currentLocationLon!);
    }
    return null;
  }

  /// Speed display in km/h
  String get speedDisplay => speed != null ? '${speed!.toStringAsFixed(0)} km/h' : 'N/A';

  /// Heading display as cardinal direction
  String get headingDisplay {
    if (heading == null) return 'N/A';
    final h = heading!;
    if (h >= 337.5 || h < 22.5) return 'N';
    if (h >= 22.5 && h < 67.5) return 'NE';
    if (h >= 67.5 && h < 112.5) return 'E';
    if (h >= 112.5 && h < 157.5) return 'SE';
    if (h >= 157.5 && h < 202.5) return 'S';
    if (h >= 202.5 && h < 247.5) return 'SW';
    if (h >= 247.5 && h < 292.5) return 'W';
    return 'NW';
  }

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

/// Truck posting for loadboard (WEB PARITY: matches /api/truck-postings response)
class TruckPosting {
  final String id;
  final String truckId;
  final Truck? truck;
  final String status;
  final String? originCityId;
  final String? destinationCityId;
  final String? originCityName;
  final String? destinationCityName;
  final double? originLat;
  final double? originLng;
  final double? destinationLat;
  final double? destinationLng;
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
  final String? carrierName;
  final bool? carrierIsVerified;
  final DateTime createdAt;
  final DateTime? postedAt;

  TruckPosting({
    required this.id,
    required this.truckId,
    this.truck,
    required this.status,
    this.originCityId,
    this.destinationCityId,
    this.originCityName,
    this.destinationCityName,
    this.originLat,
    this.originLng,
    this.destinationLat,
    this.destinationLng,
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
    this.carrierName,
    this.carrierIsVerified,
    required this.createdAt,
    this.postedAt,
  });

  factory TruckPosting.fromJson(Map<String, dynamic> json) {
    // Parse origin city data (matches web API response structure)
    final originCity = json['originCity'];
    final destinationCity = json['destinationCity'];
    final carrier = json['carrier'];

    return TruckPosting(
      id: json['id'] ?? '',
      truckId: json['truckId'] ?? '',
      truck: json['truck'] != null ? Truck.fromJson(json['truck']) : null,
      status: json['status'] ?? 'ACTIVE',
      originCityId: json['originCityId'],
      destinationCityId: json['destinationCityId'],
      // Parse city names from nested objects (web API format)
      originCityName: originCity is Map ? originCity['name'] : (json['originCityName'] ?? originCity),
      destinationCityName: destinationCity is Map ? destinationCity['name'] : (json['destinationCityName'] ?? destinationCity),
      // Parse coordinates for direction calculation
      originLat: originCity is Map ? _parseDouble(originCity['latitude']) : null,
      originLng: originCity is Map ? _parseDouble(originCity['longitude']) : null,
      destinationLat: destinationCity is Map ? _parseDouble(destinationCity['latitude']) : null,
      destinationLng: destinationCity is Map ? _parseDouble(destinationCity['longitude']) : null,
      availableFrom: json['availableFrom'] != null
          ? DateTime.parse(json['availableFrom'])
          : DateTime.now(),
      availableTo: json['availableTo'] != null
          ? DateTime.parse(json['availableTo'])
          : null,
      fullPartial: json['fullPartial'],
      availableLength: _parseDouble(json['availableLength']),
      availableWeight: _parseDouble(json['availableWeight']),
      notes: json['notes'],
      contactName: json['contactName'],
      contactPhone: json['contactPhone'],
      ownerName: json['ownerName'],
      carrierId: json['carrierId'] ?? '',
      // Parse carrier info (web API includes carrier object)
      carrierName: carrier is Map ? carrier['name'] : json['carrierName'],
      carrierIsVerified: carrier is Map ? carrier['isVerified'] : json['carrierIsVerified'],
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
      postedAt: json['postedAt'] != null
          ? DateTime.parse(json['postedAt'])
          : (json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null),
    );
  }

  static double? _parseDouble(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value);
    return null;
  }

  bool get isActive => status == 'ACTIVE';

  /// Route display: "Origin → Destination" or "Origin → Any"
  String get routeDisplay {
    final origin = originCityName ?? 'Unknown';
    final dest = destinationCityName ?? 'Any';
    return '$origin → $dest';
  }

  /// Age display: "2h", "1d", "3d" etc. (matches web behavior)
  String get ageDisplay {
    final posted = postedAt ?? createdAt;
    final diff = DateTime.now().difference(posted);

    if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m';
    } else if (diff.inHours < 24) {
      return '${diff.inHours}h';
    } else {
      return '${diff.inDays}d';
    }
  }

  /// Full/Partial display
  String get fullPartialDisplay {
    switch (fullPartial?.toUpperCase()) {
      case 'FULL':
        return 'F';
      case 'PARTIAL':
        return 'P';
      case 'BOTH':
        return 'F/P';
      default:
        return 'F';
    }
  }

  /// Availability date display
  String get availabilityDisplay {
    final now = DateTime.now();
    final diff = availableFrom.difference(now);

    if (diff.isNegative || diff.inHours < 24) {
      return 'Now';
    } else if (diff.inDays < 7) {
      return '${diff.inDays}d';
    } else {
      return '${availableFrom.month}/${availableFrom.day}';
    }
  }

  /// Truck type from nested truck object
  String get truckTypeDisplay {
    return truck?.truckTypeDisplay ?? 'Unknown';
  }

  /// Capacity from nested truck object
  String get capacityDisplay {
    return truck?.capacityDisplay ?? 'N/A';
  }

  /// Length display
  String? get lengthDisplay {
    final length = availableLength ?? truck?.lengthM;
    if (length == null) return null;
    return '${length.toStringAsFixed(1)}m';
  }

  /// Weight display
  String? get weightDisplay {
    if (availableWeight == null) return null;
    return '${(availableWeight! / 1000).toStringAsFixed(1)}t';
  }

  /// Company name (carrier or owner)
  String get companyDisplay {
    return carrierName ?? ownerName ?? 'Unknown';
  }
}
