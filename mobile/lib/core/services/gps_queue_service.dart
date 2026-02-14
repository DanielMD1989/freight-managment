import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart' show debugPrint;
import 'package:hive_flutter/hive_flutter.dart';
import '../api/api_client.dart';

/// GPS point data model for queue
class GpsPoint {
  final String truckId;
  final double latitude;
  final double longitude;
  final double? speed;
  final double? heading;
  final double? accuracy;
  final double? altitude;
  final DateTime timestamp;
  final DateTime queuedAt;

  GpsPoint({
    required this.truckId,
    required this.latitude,
    required this.longitude,
    this.speed,
    this.heading,
    this.accuracy,
    this.altitude,
    required this.timestamp,
    DateTime? queuedAt,
  }) : queuedAt = queuedAt ?? DateTime.now();

  Map<String, dynamic> toJson() => {
        'truckId': truckId,
        'latitude': latitude,
        'longitude': longitude,
        'speed': speed,
        'heading': heading,
        'accuracy': accuracy,
        'altitude': altitude,
        'timestamp': timestamp.toIso8601String(),
      };

  factory GpsPoint.fromJson(Map<String, dynamic> json) => GpsPoint(
        truckId: json['truckId'] as String,
        latitude: (json['latitude'] as num).toDouble(),
        longitude: (json['longitude'] as num).toDouble(),
        speed: json['speed'] != null ? (json['speed'] as num).toDouble() : null,
        heading: json['heading'] != null ? (json['heading'] as num).toDouble() : null,
        accuracy: json['accuracy'] != null ? (json['accuracy'] as num).toDouble() : null,
        altitude: json['altitude'] != null ? (json['altitude'] as num).toDouble() : null,
        timestamp: DateTime.parse(json['timestamp'] as String),
        queuedAt: json['queuedAt'] != null
            ? DateTime.parse(json['queuedAt'] as String)
            : DateTime.now(),
      );

  Map<String, dynamic> toHiveJson() => {
        ...toJson(),
        'queuedAt': queuedAt.toIso8601String(),
      };
}

/// Service for managing offline GPS point queue
class GpsQueueService {
  static GpsQueueService? _instance;
  static const String _boxName = 'gps_queue';
  static const int _maxQueueSize = 1000;
  static const Duration _maxAge = Duration(hours: 24);

  Box<Map>? _box;
  final ApiClient _apiClient = ApiClient();
  final Connectivity _connectivity = Connectivity();

  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  bool _isSyncing = false;
  bool _isOnline = true;

  GpsQueueService._internal();

  factory GpsQueueService() {
    _instance ??= GpsQueueService._internal();
    return _instance!;
  }

  /// Initialize the queue service
  Future<void> initialize() async {
    try {
      _box = await Hive.openBox<Map>(_boxName);

      // Check initial connectivity
      final result = await _connectivity.checkConnectivity();
      _isOnline = !result.contains(ConnectivityResult.none);

      // Listen for connectivity changes
      _connectivitySubscription = _connectivity.onConnectivityChanged.listen(_onConnectivityChanged);

      // Sync any queued points if online
      if (_isOnline) {
        await syncQueue();
      }

      assert(() {
        debugPrint('[GpsQueue] Initialized with ${_box?.length ?? 0} queued points');
        return true;
      }());
    } catch (e) {
      assert(() {
        debugPrint('[GpsQueue] Error initializing: $e');
        return true;
      }());
    }
  }

  /// Check if currently online
  bool get isOnline => _isOnline;

  /// Get queue size
  int get queueSize => _box?.length ?? 0;

  /// Handle connectivity changes
  void _onConnectivityChanged(List<ConnectivityResult> results) {
    final wasOffline = !_isOnline;
    _isOnline = !results.contains(ConnectivityResult.none);

    assert(() {
      debugPrint('[GpsQueue] Connectivity changed: $_isOnline');
      return true;
    }());

    // If we just came online, sync the queue
    if (wasOffline && _isOnline) {
      syncQueue();
    }
  }

  /// Add a GPS point to the queue
  Future<void> enqueue(GpsPoint point) async {
    if (_box == null) return;

    try {
      // Generate a unique key
      final key = '${point.truckId}_${point.timestamp.millisecondsSinceEpoch}';

      // Add to queue
      await _box!.put(key, point.toHiveJson());

      assert(() {
        debugPrint('[GpsQueue] Enqueued point, queue size: ${_box!.length}');
        return true;
      }());

      // Prune if exceeds max size
      if (_box!.length > _maxQueueSize) {
        await _pruneOldestPoints();
      }

      // Try to sync immediately if online
      if (_isOnline && !_isSyncing) {
        syncQueue();
      }
    } catch (e) {
      assert(() {
        debugPrint('[GpsQueue] Error enqueuing: $e');
        return true;
      }());
    }
  }

  /// Remove oldest points to stay within max size
  Future<void> _pruneOldestPoints() async {
    if (_box == null) return;

    final toRemove = _box!.length - _maxQueueSize;
    if (toRemove <= 0) return;

    // Get all entries sorted by queue time
    final entries = _box!.toMap().entries.toList();
    entries.sort((a, b) {
      final aTime = DateTime.tryParse(a.value['queuedAt'] ?? '') ?? DateTime.now();
      final bTime = DateTime.tryParse(b.value['queuedAt'] ?? '') ?? DateTime.now();
      return aTime.compareTo(bTime);
    });

    // Remove oldest entries
    for (var i = 0; i < toRemove; i++) {
      await _box!.delete(entries[i].key);
    }

    assert(() {
      debugPrint('[GpsQueue] Pruned $toRemove oldest points');
      return true;
    }());
  }

  /// Remove points older than max age
  Future<void> _removeExpiredPoints() async {
    if (_box == null) return;

    final cutoff = DateTime.now().subtract(_maxAge);
    final keysToRemove = <dynamic>[];

    for (final entry in _box!.toMap().entries) {
      final queuedAt = DateTime.tryParse(entry.value['queuedAt'] ?? '');
      if (queuedAt != null && queuedAt.isBefore(cutoff)) {
        keysToRemove.add(entry.key);
      }
    }

    for (final key in keysToRemove) {
      await _box!.delete(key);
    }

    if (keysToRemove.isNotEmpty) {
      assert(() {
        debugPrint('[GpsQueue] Removed ${keysToRemove.length} expired points');
        return true;
      }());
    }
  }

  /// Sync queued points with the server
  Future<void> syncQueue() async {
    if (_box == null || _box!.isEmpty || _isSyncing || !_isOnline) return;

    _isSyncing = true;

    try {
      // Remove expired points first
      await _removeExpiredPoints();

      // Get all points
      final entries = _box!.toMap().entries.toList();
      final successfulKeys = <dynamic>[];

      assert(() {
        debugPrint('[GpsQueue] Syncing ${entries.length} points...');
        return true;
      }());

      // Batch upload (max 50 at a time)
      const batchSize = 50;
      for (var i = 0; i < entries.length; i += batchSize) {
        final batchEntries = entries.skip(i).take(batchSize).toList();
        final batchPoints = batchEntries.map((e) {
          final data = Map<String, dynamic>.from(e.value);
          data.remove('queuedAt'); // Remove local-only field
          return data;
        }).toList();

        try {
          final response = await _apiClient.dio.post(
            '/api/tracking/ingest/batch',
            data: {'points': batchPoints},
          );

          if (response.statusCode == 200 || response.statusCode == 201) {
            successfulKeys.addAll(batchEntries.map((e) => e.key));
          }
        } catch (e) {
          // If batch fails, try individual uploads
          for (final entry in batchEntries) {
            try {
              final data = Map<String, dynamic>.from(entry.value);
              data.remove('queuedAt');

              final response = await _apiClient.dio.post(
                '/api/tracking/ingest',
                data: data,
              );

              if (response.statusCode == 200 || response.statusCode == 201) {
                successfulKeys.add(entry.key);
              }
            } catch (_) {
              // Point stays in queue for next sync
            }
          }
        }
      }

      // Remove successfully synced points
      for (final key in successfulKeys) {
        await _box!.delete(key);
      }

      assert(() {
        debugPrint('[GpsQueue] Synced ${successfulKeys.length} points, ${_box!.length} remaining');
        return true;
      }());
    } catch (e) {
      assert(() {
        debugPrint('[GpsQueue] Sync error: $e');
        return true;
      }());
    } finally {
      _isSyncing = false;
    }
  }

  /// Clear all queued points
  Future<void> clearQueue() async {
    await _box?.clear();
    assert(() {
      debugPrint('[GpsQueue] Queue cleared');
      return true;
    }());
  }

  /// Dispose resources
  Future<void> dispose() async {
    _connectivitySubscription?.cancel();
    await _box?.close();
  }
}
