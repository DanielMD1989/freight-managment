import 'package:json_annotation/json_annotation.dart';

part 'truck.g.dart';

/// Truck types matching the web app's TruckType enum
enum TruckType {
  @JsonValue('DRY_VAN')
  dryVan,
  @JsonValue('REEFER')
  reefer,
  @JsonValue('FLATBED')
  flatbed,
  @JsonValue('TANKER')
  tanker,
  @JsonValue('CONTAINER')
  container,
  @JsonValue('LOWBOY')
  lowboy,
  @JsonValue('DUMP')
  dump,
  @JsonValue('LIVESTOCK')
  livestock,
  @JsonValue('AUTO_CARRIER')
  autoCarrier,
  @JsonValue('OTHER')
  other,
}

/// GPS device status
enum GpsDeviceStatus {
  @JsonValue('ACTIVE')
  active,
  @JsonValue('INACTIVE')
  inactive,
  @JsonValue('SIGNAL_LOST')
  signalLost,
}

/// Verification status
enum VerificationStatus {
  @JsonValue('PENDING')
  pending,
  @JsonValue('APPROVED')
  approved,
  @JsonValue('REJECTED')
  rejected,
}

/// Truck model matching the web app's Truck type
@JsonSerializable()
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
  final String carrierId;
  final DateTime createdAt;

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
    required this.carrierId,
    required this.createdAt,
  });

  factory Truck.fromJson(Map<String, dynamic> json) => _$TruckFromJson(json);
  Map<String, dynamic> toJson() => _$TruckToJson(this);

  bool get hasGps => imei != null && imei!.isNotEmpty;
  bool get isGpsActive => gpsStatus == GpsDeviceStatus.active;
  bool get isApproved => approvalStatus == VerificationStatus.approved;

  String get truckTypeDisplay {
    switch (truckType) {
      case TruckType.dryVan:
        return 'Dry Van';
      case TruckType.reefer:
        return 'Reefer';
      case TruckType.flatbed:
        return 'Flatbed';
      case TruckType.tanker:
        return 'Tanker';
      case TruckType.container:
        return 'Container';
      case TruckType.lowboy:
        return 'Lowboy';
      case TruckType.dump:
        return 'Dump';
      case TruckType.livestock:
        return 'Livestock';
      case TruckType.autoCarrier:
        return 'Auto Carrier';
      case TruckType.other:
        return 'Other';
    }
  }
}

/// Truck posting for DAT board
@JsonSerializable()
class TruckPosting {
  final String id;
  final String truckId;
  final Truck? truck;
  final String status;
  final String? originCityId;
  final String? destinationCityId;
  final String? originCity;
  final String? destinationCity;
  final DateTime availableFrom;
  final DateTime? availableTo;
  final String? notes;
  final String? contactName;
  final String? contactPhone;
  final DateTime createdAt;

  TruckPosting({
    required this.id,
    required this.truckId,
    this.truck,
    required this.status,
    this.originCityId,
    this.destinationCityId,
    this.originCity,
    this.destinationCity,
    required this.availableFrom,
    this.availableTo,
    this.notes,
    this.contactName,
    this.contactPhone,
    required this.createdAt,
  });

  factory TruckPosting.fromJson(Map<String, dynamic> json) =>
      _$TruckPostingFromJson(json);
  Map<String, dynamic> toJson() => _$TruckPostingToJson(this);

  bool get isActive => status == 'ACTIVE';
}
