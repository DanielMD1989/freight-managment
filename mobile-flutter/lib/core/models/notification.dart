/// Notification type enum matching backend types
enum NotificationType {
  loadAssigned,
  loadStatusChange,
  truckRequest,
  truckRequestApproved,
  truckRequestRejected,
  loadRequest,
  loadRequestApproved,
  loadRequestRejected,
  gpsOffline,
  gpsOnline,
  podSubmitted,
  paymentReceived,
  paymentPending,
  userSuspended,
  ratingReceived,
  exceptionReported,
  geofenceAlert,
  newLoadMatching,
  marketing,
  system,
  unknown,
}

/// Helper to parse notification type from string
NotificationType notificationTypeFromString(String? value) {
  switch (value?.toUpperCase()) {
    case 'LOAD_ASSIGNED':
      return NotificationType.loadAssigned;
    case 'LOAD_STATUS_CHANGE':
      return NotificationType.loadStatusChange;
    case 'TRUCK_REQUEST':
      return NotificationType.truckRequest;
    case 'TRUCK_REQUEST_APPROVED':
      return NotificationType.truckRequestApproved;
    case 'TRUCK_REQUEST_REJECTED':
      return NotificationType.truckRequestRejected;
    case 'LOAD_REQUEST':
      return NotificationType.loadRequest;
    case 'LOAD_REQUEST_APPROVED':
      return NotificationType.loadRequestApproved;
    case 'LOAD_REQUEST_REJECTED':
      return NotificationType.loadRequestRejected;
    case 'GPS_OFFLINE':
      return NotificationType.gpsOffline;
    case 'GPS_ONLINE':
      return NotificationType.gpsOnline;
    case 'POD_SUBMITTED':
      return NotificationType.podSubmitted;
    case 'PAYMENT_RECEIVED':
      return NotificationType.paymentReceived;
    case 'PAYMENT_PENDING':
      return NotificationType.paymentPending;
    case 'USER_SUSPENDED':
      return NotificationType.userSuspended;
    case 'RATING_RECEIVED':
      return NotificationType.ratingReceived;
    case 'EXCEPTION_REPORTED':
      return NotificationType.exceptionReported;
    case 'GEOFENCE_ALERT':
      return NotificationType.geofenceAlert;
    case 'NEW_LOAD_MATCHING':
      return NotificationType.newLoadMatching;
    case 'MARKETING':
      return NotificationType.marketing;
    case 'SYSTEM':
      return NotificationType.system;
    default:
      return NotificationType.unknown;
  }
}

/// Notification model matching the backend schema
class AppNotification {
  final String id;
  final String userId;
  final NotificationType type;
  final String title;
  final String message;
  final bool read;
  final DateTime createdAt;
  final Map<String, dynamic>? metadata;

  AppNotification({
    required this.id,
    required this.userId,
    required this.type,
    required this.title,
    required this.message,
    required this.read,
    required this.createdAt,
    this.metadata,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['id'] ?? '',
      userId: json['userId'] ?? '',
      type: notificationTypeFromString(json['type']),
      title: json['title'] ?? '',
      message: json['message'] ?? '',
      read: json['read'] ?? false,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'type': type.name.toUpperCase(),
      'title': title,
      'message': message,
      'read': read,
      'createdAt': createdAt.toIso8601String(),
      if (metadata != null) 'metadata': metadata,
    };
  }

  /// Create a copy with updated fields
  AppNotification copyWith({
    String? id,
    String? userId,
    NotificationType? type,
    String? title,
    String? message,
    bool? read,
    DateTime? createdAt,
    Map<String, dynamic>? metadata,
  }) {
    return AppNotification(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      type: type ?? this.type,
      title: title ?? this.title,
      message: message ?? this.message,
      read: read ?? this.read,
      createdAt: createdAt ?? this.createdAt,
      metadata: metadata ?? this.metadata,
    );
  }

  /// Check if notification is unread
  bool get isUnread => !read;

  /// Get time ago string
  String get timeAgo {
    final now = DateTime.now();
    final difference = now.difference(createdAt);

    if (difference.inMinutes < 1) {
      return 'Just now';
    } else if (difference.inMinutes < 60) {
      return '${difference.inMinutes} min ago';
    } else if (difference.inHours < 24) {
      return '${difference.inHours} hour${difference.inHours > 1 ? 's' : ''} ago';
    } else if (difference.inDays == 1) {
      return 'Yesterday';
    } else if (difference.inDays < 7) {
      return '${difference.inDays} days ago';
    } else {
      return '${createdAt.day}/${createdAt.month}/${createdAt.year}';
    }
  }

  /// Get date group string (Today, Yesterday, This Week, etc.)
  String get dateGroup {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final notificationDate = DateTime(createdAt.year, createdAt.month, createdAt.day);
    final difference = today.difference(notificationDate);

    if (difference.inDays == 0) {
      return 'Today';
    } else if (difference.inDays == 1) {
      return 'Yesterday';
    } else if (difference.inDays < 7) {
      return 'This Week';
    } else if (difference.inDays < 30) {
      return 'This Month';
    } else {
      return 'Older';
    }
  }
}

/// Notification preferences model
class NotificationPreferences {
  final bool pushEnabled;
  final bool emailEnabled;
  final bool smsEnabled;
  final bool loadUpdates;
  final bool newLoads;
  final bool truckRequests;
  final bool gpsAlerts;
  final bool payments;
  final bool ratings;
  final bool marketing;
  final bool quietHoursEnabled;
  final String? quietHoursStart;
  final String? quietHoursEnd;

  NotificationPreferences({
    this.pushEnabled = true,
    this.emailEnabled = true,
    this.smsEnabled = false,
    this.loadUpdates = true,
    this.newLoads = true,
    this.truckRequests = true,
    this.gpsAlerts = true,
    this.payments = true,
    this.ratings = true,
    this.marketing = false,
    this.quietHoursEnabled = false,
    this.quietHoursStart,
    this.quietHoursEnd,
  });

  factory NotificationPreferences.fromJson(Map<String, dynamic> json) {
    return NotificationPreferences(
      pushEnabled: json['pushEnabled'] ?? true,
      emailEnabled: json['emailEnabled'] ?? true,
      smsEnabled: json['smsEnabled'] ?? false,
      loadUpdates: json['loadUpdates'] ?? json['LOAD_STATUS_CHANGE'] ?? true,
      newLoads: json['newLoads'] ?? json['NEW_LOAD_MATCHING'] ?? true,
      truckRequests: json['truckRequests'] ?? json['TRUCK_REQUEST'] ?? true,
      gpsAlerts: json['gpsAlerts'] ?? json['GPS_OFFLINE'] ?? true,
      payments: json['payments'] ?? json['PAYMENT_RECEIVED'] ?? true,
      ratings: json['ratings'] ?? json['RATING_RECEIVED'] ?? true,
      marketing: json['marketing'] ?? json['MARKETING'] ?? false,
      quietHoursEnabled: json['quietHoursEnabled'] ?? false,
      quietHoursStart: json['quietHoursStart'],
      quietHoursEnd: json['quietHoursEnd'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'pushEnabled': pushEnabled,
      'emailEnabled': emailEnabled,
      'smsEnabled': smsEnabled,
      'loadUpdates': loadUpdates,
      'newLoads': newLoads,
      'truckRequests': truckRequests,
      'gpsAlerts': gpsAlerts,
      'payments': payments,
      'ratings': ratings,
      'marketing': marketing,
      'quietHoursEnabled': quietHoursEnabled,
      if (quietHoursStart != null) 'quietHoursStart': quietHoursStart,
      if (quietHoursEnd != null) 'quietHoursEnd': quietHoursEnd,
    };
  }

  NotificationPreferences copyWith({
    bool? pushEnabled,
    bool? emailEnabled,
    bool? smsEnabled,
    bool? loadUpdates,
    bool? newLoads,
    bool? truckRequests,
    bool? gpsAlerts,
    bool? payments,
    bool? ratings,
    bool? marketing,
    bool? quietHoursEnabled,
    String? quietHoursStart,
    String? quietHoursEnd,
  }) {
    return NotificationPreferences(
      pushEnabled: pushEnabled ?? this.pushEnabled,
      emailEnabled: emailEnabled ?? this.emailEnabled,
      smsEnabled: smsEnabled ?? this.smsEnabled,
      loadUpdates: loadUpdates ?? this.loadUpdates,
      newLoads: newLoads ?? this.newLoads,
      truckRequests: truckRequests ?? this.truckRequests,
      gpsAlerts: gpsAlerts ?? this.gpsAlerts,
      payments: payments ?? this.payments,
      ratings: ratings ?? this.ratings,
      marketing: marketing ?? this.marketing,
      quietHoursEnabled: quietHoursEnabled ?? this.quietHoursEnabled,
      quietHoursStart: quietHoursStart ?? this.quietHoursStart,
      quietHoursEnd: quietHoursEnd ?? this.quietHoursEnd,
    );
  }
}
