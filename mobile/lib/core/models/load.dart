import 'package:json_annotation/json_annotation.dart';
import 'truck.dart';

part 'load.g.dart';

/// Load status matching the web app's LoadStatus enum
enum LoadStatus {
  @JsonValue('DRAFT')
  draft,
  @JsonValue('POSTED')
  posted,
  @JsonValue('SEARCHING')
  searching,
  @JsonValue('OFFERED')
  offered,
  @JsonValue('NEGOTIATING')
  negotiating,
  @JsonValue('BOOKED')
  booked,
  @JsonValue('CONFIRMED')
  confirmed,
  @JsonValue('DISPATCHED')
  dispatched,
  @JsonValue('AT_PICKUP')
  atPickup,
  @JsonValue('LOADED')
  loaded,
  @JsonValue('IN_TRANSIT')
  inTransit,
  @JsonValue('AT_DELIVERY')
  atDelivery,
  @JsonValue('DELIVERED')
  delivered,
  @JsonValue('POD_PENDING')
  podPending,
  @JsonValue('POD_SUBMITTED')
  podSubmitted,
  @JsonValue('COMPLETED')
  completed,
  @JsonValue('CANCELLED')
  cancelled,
  @JsonValue('PICKUP_DELAYED')
  pickupDelayed,
  @JsonValue('DELIVERY_DELAYED')
  deliveryDelayed,
  @JsonValue('EXCEPTION')
  exception,
}

/// Load type
enum LoadType {
  @JsonValue('FULL')
  full,
  @JsonValue('PARTIAL')
  partial,
}

/// Load model matching the web app's Load type
@JsonSerializable()
class Load {
  final String id;
  final LoadStatus status;
  final DateTime? postedAt;

  // Location & Schedule
  final String? pickupCity;
  final String? pickupCityId;
  final String? pickupAddress;
  final DateTime pickupDate;
  final String? deliveryCity;
  final String? deliveryCityId;
  final String? deliveryAddress;
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
  final bool isFullLoad;
  final LoadType? fullPartial;
  final bool isFragile;
  final bool requiresRefrigeration;

  // Distance
  final double? estimatedTripKm;
  final double? actualTripKm;

  // Pricing
  final double? baseFareEtb;
  final double? perKmEtb;
  final double? totalFareEtb;
  final double rate;

  // POD
  final String? podUrl;
  final bool podSubmitted;
  final DateTime? podSubmittedAt;
  final bool podVerified;
  final DateTime? podVerifiedAt;

  // Relationships
  final String? shipperId;
  final String? assignedTruckId;

  final DateTime createdAt;
  final DateTime updatedAt;

  Load({
    required this.id,
    required this.status,
    this.postedAt,
    this.pickupCity,
    this.pickupCityId,
    this.pickupAddress,
    required this.pickupDate,
    this.deliveryCity,
    this.deliveryCityId,
    this.deliveryAddress,
    required this.deliveryDate,
    this.originLat,
    this.originLon,
    this.destinationLat,
    this.destinationLon,
    required this.truckType,
    required this.weight,
    this.volume,
    required this.cargoDescription,
    required this.isFullLoad,
    this.fullPartial,
    required this.isFragile,
    required this.requiresRefrigeration,
    this.estimatedTripKm,
    this.actualTripKm,
    this.baseFareEtb,
    this.perKmEtb,
    this.totalFareEtb,
    required this.rate,
    this.podUrl,
    required this.podSubmitted,
    this.podSubmittedAt,
    required this.podVerified,
    this.podVerifiedAt,
    this.shipperId,
    this.assignedTruckId,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Load.fromJson(Map<String, dynamic> json) => _$LoadFromJson(json);
  Map<String, dynamic> toJson() => _$LoadToJson(this);

  String get route => '${pickupCity ?? "Unknown"} → ${deliveryCity ?? "Unknown"}';

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
      case LoadStatus.negotiating:
        return 'Negotiating';
      case LoadStatus.booked:
        return 'Booked';
      case LoadStatus.confirmed:
        return 'Confirmed';
      case LoadStatus.dispatched:
        return 'Dispatched';
      case LoadStatus.atPickup:
        return 'At Pickup';
      case LoadStatus.loaded:
        return 'Loaded';
      case LoadStatus.inTransit:
        return 'In Transit';
      case LoadStatus.atDelivery:
        return 'At Delivery';
      case LoadStatus.delivered:
        return 'Delivered';
      case LoadStatus.podPending:
        return 'POD Pending';
      case LoadStatus.podSubmitted:
        return 'POD Submitted';
      case LoadStatus.completed:
        return 'Completed';
      case LoadStatus.cancelled:
        return 'Cancelled';
      case LoadStatus.pickupDelayed:
        return 'Pickup Delayed';
      case LoadStatus.deliveryDelayed:
        return 'Delivery Delayed';
      case LoadStatus.exception:
        return 'Exception';
    }
  }

  bool get isActive => [
        LoadStatus.booked,
        LoadStatus.confirmed,
        LoadStatus.dispatched,
        LoadStatus.atPickup,
        LoadStatus.loaded,
        LoadStatus.inTransit,
        LoadStatus.atDelivery,
      ].contains(status);

  bool get canUploadPod => status == LoadStatus.delivered;

  bool get needsAttention => [
        LoadStatus.pickupDelayed,
        LoadStatus.deliveryDelayed,
        LoadStatus.exception,
      ].contains(status);
}

/// Load with shipper and truck details
@JsonSerializable()
class LoadWithDetails extends Load {
  final Map<String, dynamic>? shipper;
  final Map<String, dynamic>? assignedTruck;
  final List<Map<String, dynamic>>? events;

  LoadWithDetails({
    required super.id,
    required super.status,
    super.postedAt,
    super.pickupCity,
    super.pickupCityId,
    super.pickupAddress,
    required super.pickupDate,
    super.deliveryCity,
    super.deliveryCityId,
    super.deliveryAddress,
    required super.deliveryDate,
    super.originLat,
    super.originLon,
    super.destinationLat,
    super.destinationLon,
    required super.truckType,
    required super.weight,
    super.volume,
    required super.cargoDescription,
    required super.isFullLoad,
    super.fullPartial,
    required super.isFragile,
    required super.requiresRefrigeration,
    super.estimatedTripKm,
    super.actualTripKm,
    super.baseFareEtb,
    super.perKmEtb,
    super.totalFareEtb,
    required super.rate,
    super.podUrl,
    required super.podSubmitted,
    super.podSubmittedAt,
    required super.podVerified,
    super.podVerifiedAt,
    super.shipperId,
    super.assignedTruckId,
    required super.createdAt,
    required super.updatedAt,
    this.shipper,
    this.assignedTruck,
    this.events,
  });

  factory LoadWithDetails.fromJson(Map<String, dynamic> json) =>
      _$LoadWithDetailsFromJson(json);

  @override
  Map<String, dynamic> toJson() => _$LoadWithDetailsToJson(this);
}
