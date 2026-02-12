import 'dart:async';
import 'package:flutter/foundation.dart' show debugPrint;
import 'package:geolocator/geolocator.dart';
import '../api/api_client.dart';

/// GPS tracking service for carriers
class GpsService {
  final ApiClient _apiClient = ApiClient();

  StreamSubscription<Position>? _positionSubscription;
  Timer? _uploadTimer;

  /// Last known position
  Position? _lastPosition;
  Position? get lastPosition => _lastPosition;

  /// Current truck ID being tracked
  String? _currentTruckId;

  /// Check and request location permissions
  Future<bool> checkPermissions() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return false;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      return false;
    }

    return true;
  }

  /// Get current position
  Future<Position?> getCurrentPosition() async {
    try {
      final hasPermission = await checkPermissions();
      if (!hasPermission) return null;

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      _lastPosition = position;
      return position;
    } catch (e) {
      assert(() {
        debugPrint('[GPS] Error getting position: $e');
        return true;
      }());
      return null;
    }
  }

  /// Start continuous GPS tracking for a truck
  Future<bool> startTracking(String truckId) async {
    try {
      final hasPermission = await checkPermissions();
      if (!hasPermission) return false;

      _currentTruckId = truckId;

      // Location settings for high accuracy
      const locationSettings = LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 50, // Update every 50 meters
      );

      // Start listening to position updates
      _positionSubscription = Geolocator.getPositionStream(
        locationSettings: locationSettings,
      ).listen(
        _onPositionUpdate,
        onError: (error) {
          assert(() {
            debugPrint('[GPS] Position stream error: $error');
            return true;
          }());
        },
      );

      // Also start periodic upload timer (every 30 seconds)
      _uploadTimer = Timer.periodic(
        const Duration(seconds: 30),
        (_) => _uploadCurrentPosition(),
      );

      assert(() {
        debugPrint('[GPS] Tracking started for truck $truckId');
        return true;
      }());
      return true;
    } catch (e) {
      assert(() {
        debugPrint('[GPS] Error starting tracking: $e');
        return true;
      }());
      return false;
    }
  }

  /// Stop GPS tracking
  void stopTracking() {
    _positionSubscription?.cancel();
    _positionSubscription = null;

    _uploadTimer?.cancel();
    _uploadTimer = null;

    _currentTruckId = null;

    assert(() {
      debugPrint('[GPS] Tracking stopped');
      return true;
    }());
  }

  /// Handle position update
  void _onPositionUpdate(Position position) {
    _lastPosition = position;
    // SECURITY: Don't log GPS coordinates - privacy sensitive data
    assert(() {
      debugPrint('[GPS] Position updated');
      return true;
    }());

    // Upload immediately on significant movement
    _uploadPosition(position);
  }

  /// Upload position to server
  Future<void> _uploadPosition(Position position) async {
    if (_currentTruckId == null) return;

    try {
      await _apiClient.dio.post(
        '/api/tracking/ingest',
        data: {
          'truckId': _currentTruckId,
          'latitude': position.latitude,
          'longitude': position.longitude,
          'speed': position.speed,
          'heading': position.heading,
          'accuracy': position.accuracy,
          'altitude': position.altitude,
          'timestamp': position.timestamp.toIso8601String(),
        },
      );

      assert(() {
        debugPrint('[GPS] Position uploaded successfully');
        return true;
      }());
    } catch (e) {
      assert(() {
        debugPrint('[GPS] Error uploading position: $e');
        return true;
      }());
      // Store locally for later sync if offline
      // TODO: Implement offline queue
    }
  }

  /// Upload current position (for timer)
  Future<void> _uploadCurrentPosition() async {
    if (_lastPosition != null) {
      await _uploadPosition(_lastPosition!);
    }
  }

  /// Calculate distance between two points in kilometers
  double calculateDistance(
    double startLat,
    double startLng,
    double endLat,
    double endLng,
  ) {
    return Geolocator.distanceBetween(
          startLat,
          startLng,
          endLat,
          endLng,
        ) /
        1000;
  }

  /// Check if currently tracking
  bool get isTracking => _positionSubscription != null;

  /// Dispose resources
  void dispose() {
    stopTracking();
  }
}

/// GPS position data for UI
class GpsPosition {
  final double latitude;
  final double longitude;
  final double? speed;
  final double? heading;
  final double? accuracy;
  final DateTime timestamp;

  GpsPosition({
    required this.latitude,
    required this.longitude,
    this.speed,
    this.heading,
    this.accuracy,
    required this.timestamp,
  });

  factory GpsPosition.fromPosition(Position position) {
    return GpsPosition(
      latitude: position.latitude,
      longitude: position.longitude,
      speed: position.speed,
      heading: position.heading,
      accuracy: position.accuracy,
      timestamp: position.timestamp,
    );
  }

  String get speedKmh {
    if (speed == null || speed! < 0) return '0 km/h';
    return '${(speed! * 3.6).toStringAsFixed(0)} km/h';
  }

  String get accuracyText {
    if (accuracy == null) return 'Unknown';
    if (accuracy! < 10) return 'High';
    if (accuracy! < 50) return 'Medium';
    return 'Low';
  }
}
