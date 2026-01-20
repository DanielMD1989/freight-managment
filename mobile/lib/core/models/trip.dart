import 'truck.dart';
import 'load.dart';

/// Trip status enum matching web app
enum TripStatus {
  assigned,
  pickupPending,
  inTransit,
  delivered,
  completed,
  cancelled,
}

/// Helper to parse trip status from string
TripStatus tripStatusFromString(String? value) {
  switch (value?.toUpperCase()) {
    case 'ASSIGNED':
      return TripStatus.assigned;
    case 'PICKUP_PENDING':
      return TripStatus.pickupPending;
    case 'IN_TRANSIT':
      return TripStatus.inTransit;
    case 'DELIVERED':
      return TripStatus.delivered;
    case 'COMPLETED':
      return TripStatus.completed;
    case 'CANCELLED':
      return TripStatus.cancelled;
    default:
      return TripStatus.assigned;
  }
}

/// Helper to convert trip status to string for API
String tripStatusToString(TripStatus status) {
  switch (status) {
    case TripStatus.assigned:
      return 'ASSIGNED';
    case TripStatus.pickupPending:
      return 'PICKUP_PENDING';
    case TripStatus.inTransit:
      return 'IN_TRANSIT';
    case TripStatus.delivered:
      return 'DELIVERED';
    case TripStatus.completed:
      return 'COMPLETED';
    case TripStatus.cancelled:
      return 'CANCELLED';
  }
}

/// Trip model matching web app
class Trip {
  final String id;
  final TripStatus status;
  final String loadId;
  final String truckId;
  final String carrierId;
  final String shipperId;

  // Current location
  final double? currentLat;
  final double? currentLng;
  final DateTime? currentLocationUpdatedAt;

  // Pickup location
  final double? pickupLat;
  final double? pickupLng;
  final String? pickupAddress;
  final String? pickupCity;

  // Delivery location
  final double? deliveryLat;
  final double? deliveryLng;
  final String? deliveryAddress;
  final String? deliveryCity;

  // Timing
  final DateTime? startedAt;
  final DateTime? pickedUpAt;
  final DateTime? deliveredAt;
  final DateTime? completedAt;

  // Receiver info
  final String? receiverName;
  final String? receiverPhone;
  final String? deliveryNotes;

  // Shipper confirmation
  final bool shipperConfirmed;
  final DateTime? shipperConfirmedAt;

  // Cancellation
  final DateTime? cancelledAt;
  final String? cancelledBy;
  final String? cancelReason;

  // Distance
  final double? estimatedDistanceKm;
  final double? actualDistanceKm;
  final int? estimatedDurationMin;

  // Tracking
  final String? trackingUrl;
  final bool trackingEnabled;

  // Related objects
  final Load? load;
  final Truck? truck;
  final Organization? carrier;
  final Organization? shipper;

  final DateTime createdAt;
  final DateTime updatedAt;

  Trip({
    required this.id,
    required this.status,
    required this.loadId,
    required this.truckId,
    required this.carrierId,
    required this.shipperId,
    this.currentLat,
    this.currentLng,
    this.currentLocationUpdatedAt,
    this.pickupLat,
    this.pickupLng,
    this.pickupAddress,
    this.pickupCity,
    this.deliveryLat,
    this.deliveryLng,
    this.deliveryAddress,
    this.deliveryCity,
    this.startedAt,
    this.pickedUpAt,
    this.deliveredAt,
    this.completedAt,
    this.receiverName,
    this.receiverPhone,
    this.deliveryNotes,
    this.shipperConfirmed = false,
    this.shipperConfirmedAt,
    this.cancelledAt,
    this.cancelledBy,
    this.cancelReason,
    this.estimatedDistanceKm,
    this.actualDistanceKm,
    this.estimatedDurationMin,
    this.trackingUrl,
    this.trackingEnabled = true,
    this.load,
    this.truck,
    this.carrier,
    this.shipper,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Trip.fromJson(Map<String, dynamic> json) {
    return Trip(
      id: json['id'] ?? '',
      status: tripStatusFromString(json['status']),
      loadId: json['loadId'] ?? '',
      truckId: json['truckId'] ?? '',
      carrierId: json['carrierId'] ?? '',
      shipperId: json['shipperId'] ?? '',
      currentLat: json['currentLat']?.toDouble(),
      currentLng: json['currentLng']?.toDouble(),
      currentLocationUpdatedAt: json['currentLocationUpdatedAt'] != null
          ? DateTime.parse(json['currentLocationUpdatedAt'])
          : null,
      pickupLat: json['pickupLat']?.toDouble(),
      pickupLng: json['pickupLng']?.toDouble(),
      pickupAddress: json['pickupAddress'],
      pickupCity: json['pickupCity'],
      deliveryLat: json['deliveryLat']?.toDouble(),
      deliveryLng: json['deliveryLng']?.toDouble(),
      deliveryAddress: json['deliveryAddress'],
      deliveryCity: json['deliveryCity'],
      startedAt: json['startedAt'] != null
          ? DateTime.parse(json['startedAt'])
          : null,
      pickedUpAt: json['pickedUpAt'] != null
          ? DateTime.parse(json['pickedUpAt'])
          : null,
      deliveredAt: json['deliveredAt'] != null
          ? DateTime.parse(json['deliveredAt'])
          : null,
      completedAt: json['completedAt'] != null
          ? DateTime.parse(json['completedAt'])
          : null,
      receiverName: json['receiverName'],
      receiverPhone: json['receiverPhone'],
      deliveryNotes: json['deliveryNotes'],
      shipperConfirmed: json['shipperConfirmed'] ?? false,
      shipperConfirmedAt: json['shipperConfirmedAt'] != null
          ? DateTime.parse(json['shipperConfirmedAt'])
          : null,
      cancelledAt: json['cancelledAt'] != null
          ? DateTime.parse(json['cancelledAt'])
          : null,
      cancelledBy: json['cancelledBy'],
      cancelReason: json['cancelReason'],
      estimatedDistanceKm: json['estimatedDistanceKm']?.toDouble(),
      actualDistanceKm: json['actualDistanceKm']?.toDouble(),
      estimatedDurationMin: json['estimatedDurationMin'],
      trackingUrl: json['trackingUrl'],
      trackingEnabled: json['trackingEnabled'] ?? true,
      load: json['load'] != null ? Load.fromJson(json['load']) : null,
      truck: json['truck'] != null ? Truck.fromJson(json['truck']) : null,
      carrier: json['carrier'] != null
          ? Organization.fromJson(json['carrier'])
          : null,
      shipper: json['shipper'] != null
          ? Organization.fromJson(json['shipper'])
          : null,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'])
          : DateTime.now(),
    );
  }

  // Status display helpers
  String get statusDisplay {
    switch (status) {
      case TripStatus.assigned:
        return 'Assigned';
      case TripStatus.pickupPending:
        return 'En Route to Pickup';
      case TripStatus.inTransit:
        return 'In Transit';
      case TripStatus.delivered:
        return 'Delivered';
      case TripStatus.completed:
        return 'Completed';
      case TripStatus.cancelled:
        return 'Cancelled';
    }
  }

  bool get isActive =>
      status == TripStatus.assigned ||
      status == TripStatus.pickupPending ||
      status == TripStatus.inTransit;

  bool get canStart => status == TripStatus.assigned;
  bool get canMarkPickedUp => status == TripStatus.pickupPending;
  bool get canMarkDelivered => status == TripStatus.inTransit;
  bool get canUploadPod =>
      status == TripStatus.delivered || status == TripStatus.completed;
  bool get canCancel =>
      status != TripStatus.completed && status != TripStatus.cancelled;

  String get routeDisplay => '$pickupCity → $deliveryCity';
}

/// Trip POD (Proof of Delivery) document
class TripPod {
  final String id;
  final String tripId;
  final String fileUrl;
  final String fileName;
  final String fileType;
  final int fileSize;
  final String mimeType;
  final String? notes;
  final DateTime uploadedAt;
  final String uploadedBy;

  TripPod({
    required this.id,
    required this.tripId,
    required this.fileUrl,
    required this.fileName,
    required this.fileType,
    required this.fileSize,
    required this.mimeType,
    this.notes,
    required this.uploadedAt,
    required this.uploadedBy,
  });

  factory TripPod.fromJson(Map<String, dynamic> json) {
    return TripPod(
      id: json['id'] ?? '',
      tripId: json['tripId'] ?? '',
      fileUrl: json['fileUrl'] ?? '',
      fileName: json['fileName'] ?? '',
      fileType: json['fileType'] ?? 'IMAGE',
      fileSize: json['fileSize'] ?? 0,
      mimeType: json['mimeType'] ?? 'image/jpeg',
      notes: json['notes'],
      uploadedAt: json['uploadedAt'] != null
          ? DateTime.parse(json['uploadedAt'])
          : DateTime.now(),
      uploadedBy: json['uploadedBy'] ?? '',
    );
  }

  bool get isImage =>
      fileType == 'IMAGE' || mimeType.startsWith('image/');
}

/// GPS position for trip tracking
class GpsPosition {
  final String id;
  final double latitude;
  final double longitude;
  final double? speed;
  final double? heading;
  final double? altitude;
  final double? accuracy;
  final DateTime timestamp;

  GpsPosition({
    required this.id,
    required this.latitude,
    required this.longitude,
    this.speed,
    this.heading,
    this.altitude,
    this.accuracy,
    required this.timestamp,
  });

  factory GpsPosition.fromJson(Map<String, dynamic> json) {
    return GpsPosition(
      id: json['id'] ?? '',
      latitude: (json['latitude'] ?? 0).toDouble(),
      longitude: (json['longitude'] ?? 0).toDouble(),
      speed: json['speed']?.toDouble(),
      heading: json['heading']?.toDouble(),
      altitude: json['altitude']?.toDouble(),
      accuracy: json['accuracy']?.toDouble(),
      timestamp: json['timestamp'] != null
          ? DateTime.parse(json['timestamp'])
          : DateTime.now(),
    );
  }
}

/// Organization reference (carrier or shipper)
class Organization {
  final String id;
  final String name;
  final bool isVerified;
  final String? contactPhone;
  final String? contactEmail;

  Organization({
    required this.id,
    required this.name,
    this.isVerified = false,
    this.contactPhone,
    this.contactEmail,
  });

  factory Organization.fromJson(Map<String, dynamic> json) {
    return Organization(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      isVerified: json['isVerified'] ?? false,
      contactPhone: json['contactPhone'],
      contactEmail: json['contactEmail'],
    );
  }
}
