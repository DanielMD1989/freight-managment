/// Organization types matching the Prisma schema OrganizationType enum
enum OrganizationType {
  shipper,
  carrierCompany,
  carrierIndividual,
  carrierAssociation,
  fleetOwner,
  logisticsAgent,
}

extension OrganizationTypeExtension on OrganizationType {
  String get value {
    switch (this) {
      case OrganizationType.shipper:
        return 'SHIPPER';
      case OrganizationType.carrierCompany:
        return 'CARRIER_COMPANY';
      case OrganizationType.carrierIndividual:
        return 'CARRIER_INDIVIDUAL';
      case OrganizationType.carrierAssociation:
        return 'CARRIER_ASSOCIATION';
      case OrganizationType.fleetOwner:
        return 'FLEET_OWNER';
      case OrganizationType.logisticsAgent:
        return 'LOGISTICS_AGENT';
    }
  }

  String get displayName {
    switch (this) {
      case OrganizationType.shipper:
        return 'Shipper';
      case OrganizationType.carrierCompany:
        return 'Carrier Company';
      case OrganizationType.carrierIndividual:
        return 'Individual Carrier';
      case OrganizationType.carrierAssociation:
        return 'Carrier Association';
      case OrganizationType.fleetOwner:
        return 'Fleet Owner';
      case OrganizationType.logisticsAgent:
        return 'Logistics Agent';
    }
  }

  static OrganizationType fromString(String value) {
    switch (value) {
      case 'SHIPPER':
        return OrganizationType.shipper;
      case 'CARRIER_COMPANY':
        return OrganizationType.carrierCompany;
      case 'CARRIER_INDIVIDUAL':
        return OrganizationType.carrierIndividual;
      case 'CARRIER_ASSOCIATION':
        return OrganizationType.carrierAssociation;
      case 'FLEET_OWNER':
        return OrganizationType.fleetOwner;
      case 'LOGISTICS_AGENT':
        return OrganizationType.logisticsAgent;
      default:
        return OrganizationType.shipper;
    }
  }

  /// Check if this is a carrier type
  bool get isCarrierType {
    return this == OrganizationType.carrierCompany ||
           this == OrganizationType.carrierIndividual ||
           this == OrganizationType.carrierAssociation ||
           this == OrganizationType.fleetOwner;
  }
}

/// User roles matching the web app's UserRole enum
enum UserRole {
  superAdmin,
  admin,
  dispatcher,
  carrier,
  shipper,
}

extension UserRoleExtension on UserRole {
  String get value {
    switch (this) {
      case UserRole.superAdmin:
        return 'SUPER_ADMIN';
      case UserRole.admin:
        return 'ADMIN';
      case UserRole.dispatcher:
        return 'DISPATCHER';
      case UserRole.carrier:
        return 'CARRIER';
      case UserRole.shipper:
        return 'SHIPPER';
    }
  }

  static UserRole fromString(String value) {
    switch (value) {
      case 'SUPER_ADMIN':
        return UserRole.superAdmin;
      case 'ADMIN':
        return UserRole.admin;
      case 'DISPATCHER':
        return UserRole.dispatcher;
      case 'CARRIER':
        return UserRole.carrier;
      case 'SHIPPER':
        return UserRole.shipper;
      default:
        return UserRole.shipper;
    }
  }
}

/// User status matching the web app's UserStatus enum
enum UserStatus {
  registered,
  pendingVerification,
  active,
  suspended,
  rejected,
}

extension UserStatusExtension on UserStatus {
  String get value {
    switch (this) {
      case UserStatus.registered:
        return 'REGISTERED';
      case UserStatus.pendingVerification:
        return 'PENDING_VERIFICATION';
      case UserStatus.active:
        return 'ACTIVE';
      case UserStatus.suspended:
        return 'SUSPENDED';
      case UserStatus.rejected:
        return 'REJECTED';
    }
  }

  static UserStatus fromString(String value) {
    switch (value) {
      case 'REGISTERED':
        return UserStatus.registered;
      case 'PENDING_VERIFICATION':
        return UserStatus.pendingVerification;
      case 'ACTIVE':
        return UserStatus.active;
      case 'SUSPENDED':
        return UserStatus.suspended;
      case 'REJECTED':
        return UserStatus.rejected;
      default:
        return UserStatus.registered;
    }
  }
}

/// User model matching the web app's User type
class User {
  final String id;
  final String email;
  final String? firstName;
  final String? lastName;
  final String? phone;
  final UserRole role;
  final UserStatus status;
  final String? organizationId;
  final Organization? organization;
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
    this.organization,
    required this.isActive,
    this.lastLoginAt,
    required this.createdAt,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      email: json['email'] as String,
      firstName: json['firstName'] as String?,
      lastName: json['lastName'] as String?,
      phone: json['phone'] as String?,
      role: UserRoleExtension.fromString(json['role'] as String? ?? 'SHIPPER'),
      status: UserStatusExtension.fromString(json['status'] as String? ?? 'REGISTERED'),
      organizationId: json['organizationId'] as String?,
      organization: json['organization'] != null
          ? Organization.fromJson(json['organization'] as Map<String, dynamic>)
          : null,
      isActive: json['isActive'] as bool? ?? true,
      lastLoginAt: json['lastLoginAt'] != null
          ? DateTime.parse(json['lastLoginAt'] as String)
          : null,
      createdAt: DateTime.parse(json['createdAt'] as String? ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'firstName': firstName,
      'lastName': lastName,
      'phone': phone,
      'role': role.value,
      'status': status.value,
      'organizationId': organizationId,
      'organization': organization?.toJson(),
      'isActive': isActive,
      'lastLoginAt': lastLoginAt?.toIso8601String(),
      'createdAt': createdAt.toIso8601String(),
    };
  }

  String get fullName {
    final parts = [firstName, lastName].where((p) => p != null && p.isNotEmpty);
    return parts.isNotEmpty ? parts.join(' ') : email;
  }

  String get roleDisplayName => role.value;

  bool get isCarrier => role == UserRole.carrier;
  bool get isShipper => role == UserRole.shipper;
  bool get isAdmin => role == UserRole.admin || role == UserRole.superAdmin;
}

/// Organization model
class Organization {
  final String id;
  final String name;
  final OrganizationType type;
  final String? description;
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
    required this.type,
    this.description,
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

  factory Organization.fromJson(Map<String, dynamic> json) {
    return Organization(
      id: json['id'] as String,
      name: json['name'] as String,
      type: OrganizationTypeExtension.fromString(json['type'] as String? ?? 'SHIPPER'),
      description: json['description'] as String?,
      tinNumber: json['tinNumber'] as String?,
      licenseNumber: json['licenseNumber'] as String?,
      address: json['address'] as String?,
      city: json['city'] as String?,
      phone: json['phone'] as String? ?? json['contactPhone'] as String?,
      email: json['email'] as String? ?? json['contactEmail'] as String?,
      isVerified: json['isVerified'] as bool? ?? false,
      verifiedAt: json['verifiedAt'] != null
          ? DateTime.parse(json['verifiedAt'] as String)
          : null,
      createdAt: DateTime.parse(json['createdAt'] as String? ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'type': type.value,
      'description': description,
      'tinNumber': tinNumber,
      'licenseNumber': licenseNumber,
      'address': address,
      'city': city,
      'phone': phone,
      'email': email,
      'isVerified': isVerified,
      'verifiedAt': verifiedAt?.toIso8601String(),
      'createdAt': createdAt.toIso8601String(),
    };
  }

  /// Check if this organization is a carrier type
  bool get isCarrier => type.isCarrierType;

  /// Check if this organization is a shipper
  bool get isShipper => type == OrganizationType.shipper;

  /// Alias for phone (for compatibility with web API)
  String? get contactPhone => phone;

  /// Alias for email (for compatibility with web API)
  String? get contactEmail => email;
}
