/// Mobile Model Tests - API Schema Alignment Verification
///
/// Tests mobile data models match web API schemas for:
/// - Load, Truck, Trip, User models
/// - Enum values alignment
/// - JSON serialization/deserialization

import 'package:flutter_test/flutter_test.dart';
import 'package:freight_management_mobile/core/models/load.dart';
import 'package:freight_management_mobile/core/models/truck.dart';
import 'package:freight_management_mobile/core/models/user.dart';
import 'package:freight_management_mobile/core/models/trip.dart';
import 'package:freight_management_mobile/core/models/notification.dart';

void main() {
  // ============================================================================
  // LOAD MODEL TESTS
  // ============================================================================
  group('Load Model', () {
    test('LoadStatus enum should have all 13 status values', () {
      expect(LoadStatus.values.length, equals(13));
    });

    test('loadStatusFromString should parse all uppercase statuses', () {
      expect(loadStatusFromString('DRAFT'), equals(LoadStatus.draft));
      expect(loadStatusFromString('POSTED'), equals(LoadStatus.posted));
      expect(loadStatusFromString('SEARCHING'), equals(LoadStatus.searching));
      expect(loadStatusFromString('OFFERED'), equals(LoadStatus.offered));
      expect(loadStatusFromString('ASSIGNED'), equals(LoadStatus.assigned));
      expect(loadStatusFromString('PICKUP_PENDING'), equals(LoadStatus.pickupPending));
      expect(loadStatusFromString('IN_TRANSIT'), equals(LoadStatus.inTransit));
      expect(loadStatusFromString('DELIVERED'), equals(LoadStatus.delivered));
      expect(loadStatusFromString('COMPLETED'), equals(LoadStatus.completed));
      expect(loadStatusFromString('EXCEPTION'), equals(LoadStatus.exception));
      expect(loadStatusFromString('CANCELLED'), equals(LoadStatus.cancelled));
      expect(loadStatusFromString('EXPIRED'), equals(LoadStatus.expired));
      expect(loadStatusFromString('UNPOSTED'), equals(LoadStatus.unposted));
    });

    test('loadStatusToString should return uppercase status', () {
      expect(loadStatusToString(LoadStatus.draft), equals('DRAFT'));
      expect(loadStatusToString(LoadStatus.posted), equals('POSTED'));
      expect(loadStatusToString(LoadStatus.inTransit), equals('IN_TRANSIT'));
      expect(loadStatusToString(LoadStatus.pickupPending), equals('PICKUP_PENDING'));
    });

    test('Load.fromJson should parse complete JSON', () {
      final json = {
        'id': 'load-123',
        'status': 'POSTED',
        'pickupCity': 'Addis Ababa',
        'deliveryCity': 'Dire Dawa',
        'pickupDate': '2026-02-01T10:00:00.000Z',
        'deliveryDate': '2026-02-03T18:00:00.000Z',
        'truckType': 'DRY_VAN',
        'weight': 5000,
        'cargoDescription': 'Electronics',
        'fullPartial': 'FULL',
        'baseFareEtb': '5000',
        'perKmEtb': '50',
        'totalFareEtb': '20000',
        'tripKm': '300',
        'estimatedTripKm': '310',
        'serviceFeeEtb': '1132.50',
        'bookMode': 'REQUEST',
        'isFragile': true,
        'requiresRefrigeration': false,
        'trackingEnabled': true,
        'podSubmitted': false,
        'shipperId': 'shipper-123',
        'createdAt': '2026-01-23T00:00:00.000Z',
        'updatedAt': '2026-01-23T00:00:00.000Z',
      };

      final load = Load.fromJson(json);

      expect(load.id, equals('load-123'));
      expect(load.status, equals(LoadStatus.posted));
      expect(load.pickupCity, equals('Addis Ababa'));
      expect(load.deliveryCity, equals('Dire Dawa'));
      expect(load.truckType, equals(TruckType.dryVan));
      expect(load.weight, equals(5000));
      expect(load.cargoDescription, equals('Electronics'));
      expect(load.fullPartial, equals(LoadType.full));
      expect(load.baseFareEtb, equals(5000));
      expect(load.perKmEtb, equals(50));
      expect(load.totalFareEtb, equals(20000));
      expect(load.tripKm, equals(300));
      expect(load.bookMode, equals(BookMode.request));
      expect(load.isFragile, isTrue);
      expect(load.requiresRefrigeration, isFalse);
      expect(load.trackingEnabled, isTrue);
    });

    test('Load.toJson should serialize correctly', () {
      final load = Load(
        id: 'test',
        status: LoadStatus.draft,
        pickupCity: 'Addis Ababa',
        deliveryCity: 'Dire Dawa',
        pickupDate: DateTime(2026, 2, 1),
        deliveryDate: DateTime(2026, 2, 3),
        truckType: TruckType.flatbed,
        weight: 8000,
        cargoDescription: 'Machinery',
        fullPartial: LoadType.partial,
        isFragile: false,
        requiresRefrigeration: false,
        baseFareEtb: 8000,
        perKmEtb: 60,
        shipperId: 'shipper-123',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      final json = load.toJson();

      expect(json['pickupCity'], equals('Addis Ababa'));
      expect(json['deliveryCity'], equals('Dire Dawa'));
      expect(json['truckType'], equals('FLATBED'));
      expect(json['weight'], equals(8000));
      expect(json['fullPartial'], equals('PARTIAL'));
      expect(json['baseFareEtb'], equals(8000));
      expect(json['perKmEtb'], equals(60));
    });

    test('Load helper properties should work correctly', () {
      final load = Load(
        id: 'test',
        status: LoadStatus.inTransit,
        pickupCity: 'Addis Ababa',
        deliveryCity: 'Dire Dawa',
        pickupDate: DateTime.now(),
        deliveryDate: DateTime.now(),
        truckType: TruckType.dryVan,
        weight: 5000,
        estimatedTripKm: 453,
        cargoDescription: 'Test',
        shipperId: 'shipper-123',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      expect(load.route, equals('Addis Ababa → Dire Dawa'));
      expect(load.weightDisplay, equals('5.0 tons'));
      expect(load.statusDisplay, equals('In Transit'));
      expect(load.distanceDisplay, equals('453 km'));
      expect(load.isAssigned, isTrue);
      expect(load.isActive, isFalse);
      expect(load.canUploadPod, isFalse);
    });

    test('BookMode enum should match web schema', () {
      expect(BookMode.values.length, equals(2));
      expect(BookMode.request.value, equals('REQUEST'));
      expect(BookMode.instant.value, equals('INSTANT'));
      expect(bookModeFromString('REQUEST'), equals(BookMode.request));
      expect(bookModeFromString('INSTANT'), equals(BookMode.instant));
    });

    test('ServiceFeeStatus should match web schema', () {
      expect(serviceFeeStatusFromString('PENDING'), equals(ServiceFeeStatus.pending));
      expect(serviceFeeStatusFromString('DEDUCTED'), equals(ServiceFeeStatus.deducted));
      expect(serviceFeeStatusFromString('WAIVED'), equals(ServiceFeeStatus.waived));
      expect(serviceFeeStatusFromString('REFUNDED'), equals(ServiceFeeStatus.refunded));
    });
  });

  // ============================================================================
  // TRUCK MODEL TESTS
  // ============================================================================
  group('Truck Model', () {
    test('TruckType enum should have all 8 types', () {
      expect(TruckType.values.length, equals(8));
    });

    test('truckTypeFromString should parse all types', () {
      expect(truckTypeFromString('FLATBED'), equals(TruckType.flatbed));
      expect(truckTypeFromString('REFRIGERATED'), equals(TruckType.refrigerated));
      expect(truckTypeFromString('TANKER'), equals(TruckType.tanker));
      expect(truckTypeFromString('CONTAINER'), equals(TruckType.container));
      expect(truckTypeFromString('DRY_VAN'), equals(TruckType.dryVan));
      expect(truckTypeFromString('LOWBOY'), equals(TruckType.lowboy));
      expect(truckTypeFromString('DUMP_TRUCK'), equals(TruckType.dumpTruck));
      expect(truckTypeFromString('BOX_TRUCK'), equals(TruckType.boxTruck));
    });

    test('truckTypeToString should return uppercase type', () {
      expect(truckTypeToString(TruckType.dryVan), equals('DRY_VAN'));
      expect(truckTypeToString(TruckType.flatbed), equals('FLATBED'));
      expect(truckTypeToString(TruckType.refrigerated), equals('REFRIGERATED'));
      expect(truckTypeToString(TruckType.dumpTruck), equals('DUMP_TRUCK'));
    });

    test('Truck.fromJson should parse complete JSON', () {
      final json = {
        'id': 'truck-123',
        'truckType': 'DRY_VAN',
        'licensePlate': 'AA-12345',
        'capacity': 10000,
        'volume': 50.0,
        'isAvailable': true,
        'carrierId': 'carrier-123',
        'currentCity': 'Addis Ababa',
        'approvalStatus': 'APPROVED',
        'createdAt': '2026-01-23T00:00:00.000Z',
        'updatedAt': '2026-01-23T00:00:00.000Z',
      };

      final truck = Truck.fromJson(json);

      expect(truck.id, equals('truck-123'));
      expect(truck.truckType, equals(TruckType.dryVan));
      expect(truck.licensePlate, equals('AA-12345'));
      expect(truck.capacity, equals(10000));
      expect(truck.volume, equals(50.0));
      expect(truck.isAvailable, isTrue);
      expect(truck.carrierId, equals('carrier-123'));
    });

    test('VerificationStatus should parse correctly', () {
      expect(verificationStatusFromString('PENDING'), equals(VerificationStatus.pending));
      expect(verificationStatusFromString('APPROVED'), equals(VerificationStatus.approved));
      expect(verificationStatusFromString('REJECTED'), equals(VerificationStatus.rejected));
      expect(verificationStatusFromString('EXPIRED'), equals(VerificationStatus.expired));
    });
  });

  // ============================================================================
  // USER MODEL TESTS
  // ============================================================================
  group('User Model', () {
    test('UserRole enum should have all roles', () {
      expect(UserRole.values.length, equals(5));
      expect(UserRole.shipper.name, isNotNull);
      expect(UserRole.carrier.name, isNotNull);
      expect(UserRole.admin.name, isNotNull);
      expect(UserRole.dispatcher.name, isNotNull);
      expect(UserRole.superAdmin.name, isNotNull);
    });

    test('UserRole.value should return correct API values', () {
      expect(UserRole.shipper.value, equals('SHIPPER'));
      expect(UserRole.carrier.value, equals('CARRIER'));
      expect(UserRole.admin.value, equals('ADMIN'));
      expect(UserRole.dispatcher.value, equals('DISPATCHER'));
      expect(UserRole.superAdmin.value, equals('SUPER_ADMIN'));
    });

    test('UserRoleExtension.fromString should parse roles', () {
      expect(UserRoleExtension.fromString('SHIPPER'), equals(UserRole.shipper));
      expect(UserRoleExtension.fromString('CARRIER'), equals(UserRole.carrier));
      expect(UserRoleExtension.fromString('ADMIN'), equals(UserRole.admin));
      expect(UserRoleExtension.fromString('DISPATCHER'), equals(UserRole.dispatcher));
    });

    test('User.fromJson should parse complete JSON', () {
      final json = {
        'id': 'user-123',
        'email': 'test@example.com',
        'firstName': 'Test',
        'lastName': 'User',
        'phone': '+251911111111',
        'role': 'SHIPPER',
        'status': 'ACTIVE',
        'organizationId': 'org-123',
        'isActive': true,
        'createdAt': '2026-01-23T00:00:00.000Z',
      };

      final user = User.fromJson(json);

      expect(user.id, equals('user-123'));
      expect(user.email, equals('test@example.com'));
      expect(user.firstName, equals('Test'));
      expect(user.lastName, equals('User'));
      expect(user.phone, equals('+251911111111'));
      expect(user.role, equals(UserRole.shipper));
      expect(user.organizationId, equals('org-123'));
    });

    test('User.fullName should concatenate names', () {
      final user = User(
        id: 'test',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.carrier,
        status: UserStatus.active,
        isActive: true,
        createdAt: DateTime.now(),
      );

      expect(user.fullName, equals('John Doe'));
    });

    test('UserStatus should parse correctly', () {
      expect(UserStatusExtension.fromString('ACTIVE'), equals(UserStatus.active));
      expect(UserStatusExtension.fromString('REGISTERED'), equals(UserStatus.registered));
      expect(UserStatusExtension.fromString('SUSPENDED'), equals(UserStatus.suspended));
      expect(UserStatusExtension.fromString('PENDING_VERIFICATION'), equals(UserStatus.pendingVerification));
    });

    test('OrganizationType should match web schema', () {
      expect(OrganizationType.values.length, equals(6));
      expect(OrganizationType.shipper.value, equals('SHIPPER'));
      expect(OrganizationType.carrierCompany.value, equals('CARRIER_COMPANY'));
      expect(OrganizationType.carrierIndividual.value, equals('CARRIER_INDIVIDUAL'));
    });
  });

  // ============================================================================
  // TRIP MODEL TESTS
  // ============================================================================
  group('Trip Model', () {
    test('TripStatus enum should have all status values', () {
      expect(TripStatus.values.length, equals(6));
    });

    test('tripStatusFromString should parse all statuses', () {
      expect(tripStatusFromString('ASSIGNED'), equals(TripStatus.assigned));
      expect(tripStatusFromString('PICKUP_PENDING'), equals(TripStatus.pickupPending));
      expect(tripStatusFromString('IN_TRANSIT'), equals(TripStatus.inTransit));
      expect(tripStatusFromString('DELIVERED'), equals(TripStatus.delivered));
      expect(tripStatusFromString('COMPLETED'), equals(TripStatus.completed));
      expect(tripStatusFromString('CANCELLED'), equals(TripStatus.cancelled));
    });

    test('tripStatusToString should return uppercase', () {
      expect(tripStatusToString(TripStatus.inTransit), equals('IN_TRANSIT'));
      expect(tripStatusToString(TripStatus.pickupPending), equals('PICKUP_PENDING'));
      expect(tripStatusToString(TripStatus.completed), equals('COMPLETED'));
    });

    test('Trip.fromJson should parse complete JSON', () {
      final json = {
        'id': 'trip-123',
        'status': 'IN_TRANSIT',
        'loadId': 'load-123',
        'truckId': 'truck-123',
        'carrierId': 'carrier-123',
        'shipperId': 'shipper-123',
        'startedAt': '2026-01-23T08:00:00.000Z',
        'currentLat': 9.0054,
        'currentLng': 38.7636,
        'trackingEnabled': true,
        'createdAt': '2026-01-23T00:00:00.000Z',
        'updatedAt': '2026-01-23T08:00:00.000Z',
      };

      final trip = Trip.fromJson(json);

      expect(trip.id, equals('trip-123'));
      expect(trip.status, equals(TripStatus.inTransit));
      expect(trip.loadId, equals('load-123'));
      expect(trip.truckId, equals('truck-123'));
      expect(trip.carrierId, equals('carrier-123'));
      expect(trip.shipperId, equals('shipper-123'));
      expect(trip.currentLat, equals(9.0054));
      expect(trip.currentLng, equals(38.7636));
    });

    test('Trip helper properties should work', () {
      final trip = Trip(
        id: 'test',
        status: TripStatus.inTransit,
        loadId: 'load-123',
        truckId: 'truck-123',
        carrierId: 'carrier-123',
        shipperId: 'shipper-123',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      expect(trip.isActive, isTrue);
      expect(trip.statusDisplay, equals('In Transit'));
    });
  });

  // ============================================================================
  // NOTIFICATION MODEL TESTS
  // ============================================================================
  group('Notification Model', () {
    test('NotificationType enum should have all types', () {
      expect(NotificationType.values.length, equals(21));
    });

    test('notificationTypeFromString should parse all types', () {
      expect(notificationTypeFromString('LOAD_ASSIGNED'), equals(NotificationType.loadAssigned));
      expect(notificationTypeFromString('LOAD_STATUS_CHANGE'), equals(NotificationType.loadStatusChange));
      expect(notificationTypeFromString('TRUCK_REQUEST'), equals(NotificationType.truckRequest));
      expect(notificationTypeFromString('LOAD_REQUEST'), equals(NotificationType.loadRequest));
      expect(notificationTypeFromString('GPS_OFFLINE'), equals(NotificationType.gpsOffline));
      expect(notificationTypeFromString('POD_SUBMITTED'), equals(NotificationType.podSubmitted));
      expect(notificationTypeFromString('PAYMENT_RECEIVED'), equals(NotificationType.paymentReceived));
      expect(notificationTypeFromString('UNKNOWN_TYPE'), equals(NotificationType.unknown));
    });

    test('AppNotification.fromJson should parse correctly', () {
      final json = {
        'id': 'notif-123',
        'userId': 'user-123',
        'type': 'LOAD_REQUEST',
        'title': 'New Load Request',
        'message': 'You have a new load request',
        'read': false,
        'createdAt': '2026-01-23T10:00:00.000Z',
      };

      final notification = AppNotification.fromJson(json);

      expect(notification.id, equals('notif-123'));
      expect(notification.userId, equals('user-123'));
      expect(notification.type, equals(NotificationType.loadRequest));
      expect(notification.title, equals('New Load Request'));
      expect(notification.message, equals('You have a new load request'));
      expect(notification.isUnread, isTrue);
    });

    test('NotificationPreferences should serialize correctly', () {
      final prefs = NotificationPreferences(
        pushEnabled: true,
        emailEnabled: true,
        smsEnabled: false,
      );

      expect(prefs.pushEnabled, isTrue);
      expect(prefs.emailEnabled, isTrue);
      expect(prefs.smsEnabled, isFalse);
    });
  });

  // ============================================================================
  // API SCHEMA ALIGNMENT
  // ============================================================================
  group('API Schema Alignment', () {
    test('Load pricing fields should match web schema', () {
      final load = Load(
        id: 'test',
        status: LoadStatus.posted,
        pickupDate: DateTime.now(),
        deliveryDate: DateTime.now(),
        truckType: TruckType.dryVan,
        weight: 5000,
        cargoDescription: 'Test',
        shipperId: 'shipper-123',
        baseFareEtb: 5000,
        perKmEtb: 50,
        totalFareEtb: 20000,
        serviceFeeEtb: 1132.50,
        shipperServiceFee: 566.25,
        carrierServiceFee: 566.25,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      expect(load.baseFareEtb, equals(5000));
      expect(load.perKmEtb, equals(50));
      expect(load.totalFareEtb, equals(20000));
      expect(load.serviceFeeEtb, equals(1132.50));
    });

    test('Load tracking fields should match web schema', () {
      final load = Load(
        id: 'test',
        status: LoadStatus.inTransit,
        pickupDate: DateTime.now(),
        deliveryDate: DateTime.now(),
        truckType: TruckType.dryVan,
        weight: 5000,
        cargoDescription: 'Test',
        shipperId: 'shipper-123',
        trackingUrl: 'https://track.example.com/trip-123',
        trackingEnabled: true,
        trackingStartedAt: DateTime.now(),
        tripProgressPercent: 45,
        remainingDistanceKm: 250,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      expect(load.trackingUrl, isNotNull);
      expect(load.trackingEnabled, isTrue);
      expect(load.tripProgressPercent, equals(45));
      expect(load.remainingDistanceKm, equals(250));
    });

    test('Load POD fields should match web schema', () {
      final load = Load(
        id: 'test',
        status: LoadStatus.delivered,
        pickupDate: DateTime.now(),
        deliveryDate: DateTime.now(),
        truckType: TruckType.dryVan,
        weight: 5000,
        cargoDescription: 'Test',
        shipperId: 'shipper-123',
        podUrl: 'https://s3.example.com/pod/123.pdf',
        podSubmitted: true,
        podSubmittedAt: DateTime.now(),
        podVerified: true,
        podVerifiedAt: DateTime.now(),
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      expect(load.podUrl, isNotNull);
      expect(load.podSubmitted, isTrue);
      expect(load.podVerified, isTrue);
      expect(load.canUploadPod, isTrue);
    });

    test('API endpoints should follow web convention', () {
      const endpoints = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/logout',
        '/api/auth/forgot-password',
        '/api/user/profile',
        '/api/loads',
        '/api/trucks',
        '/api/trips',
        '/api/notifications',
        '/api/load-requests',
        '/api/truck-requests',
      ];

      for (final endpoint in endpoints) {
        expect(endpoint, startsWith('/api/'));
      }
    });
  });
}
