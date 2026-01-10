import 'package:json_annotation/json_annotation.dart';

part 'user.g.dart';

/// User roles matching the web app's UserRole enum
enum UserRole {
  @JsonValue('SUPER_ADMIN')
  superAdmin,
  @JsonValue('ADMIN')
  admin,
  @JsonValue('DISPATCHER')
  dispatcher,
  @JsonValue('CARRIER')
  carrier,
  @JsonValue('SHIPPER')
  shipper,
}

/// User status matching the web app's UserStatus enum
enum UserStatus {
  @JsonValue('REGISTERED')
  registered,
  @JsonValue('PENDING_VERIFICATION')
  pendingVerification,
  @JsonValue('ACTIVE')
  active,
  @JsonValue('SUSPENDED')
  suspended,
  @JsonValue('REJECTED')
  rejected,
}

/// User model matching the web app's User type
@JsonSerializable()
class User {
  final String id;
  final String email;
  final String? firstName;
  final String? lastName;
  final String? phone;
  final UserRole role;
  final UserStatus status;
  final String? organizationId;
  final bool isActive;
  final DateTime? lastLoginAt;
  final DateTime createdAt;

  User({
    required this.id,
    required this.email,
    this.firstName,
    this.lastName,
    this.phone,
    required this.role,
    required this.status,
    this.organizationId,
    required this.isActive,
    this.lastLoginAt,
    required this.createdAt,
  });

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
  Map<String, dynamic> toJson() => _$UserToJson(this);

  String get fullName {
    final parts = [firstName, lastName].where((p) => p != null && p.isNotEmpty);
    return parts.isNotEmpty ? parts.join(' ') : email;
  }

  bool get isCarrier => role == UserRole.carrier;
  bool get isShipper => role == UserRole.shipper;
  bool get isAdmin => role == UserRole.admin || role == UserRole.superAdmin;
}

/// Organization model
@JsonSerializable()
class Organization {
  final String id;
  final String name;
  final String? tinNumber;
  final String? licenseNumber;
  final String? address;
  final String? city;
  final String? phone;
  final String? email;
  final bool isVerified;
  final DateTime? verifiedAt;
  final DateTime createdAt;

  Organization({
    required this.id,
    required this.name,
    this.tinNumber,
    this.licenseNumber,
    this.address,
    this.city,
    this.phone,
    this.email,
    required this.isVerified,
    this.verifiedAt,
    required this.createdAt,
  });

  factory Organization.fromJson(Map<String, dynamic> json) =>
      _$OrganizationFromJson(json);
  Map<String, dynamic> toJson() => _$OrganizationToJson(this);
}
