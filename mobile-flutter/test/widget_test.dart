// Basic Flutter widget test for FreightManagementApp
//
// Tests that the app can be instantiated without crashing.

import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:freight_management_mobile/app.dart';

void main() {
  testWidgets('App renders without crashing', (WidgetTester tester) async {
    // Set a larger test viewport to avoid overflow errors
    tester.view.physicalSize = const Size(1080, 1920);
    tester.view.devicePixelRatio = 1.0;

    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    // Build our app and trigger a frame.
    await tester.pumpWidget(
      const ProviderScope(
        child: FreightManagementApp(),
      ),
    );

    // Allow async operations to complete
    await tester.pump();

    // Verify the app renders (loading state with logo or similar)
    // The app should at least render without throwing errors
    expect(tester.takeException(), isNull);
  });
}
