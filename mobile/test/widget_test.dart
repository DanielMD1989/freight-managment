// Basic Flutter widget test for FreightManagementApp
//
// Tests that the app can be instantiated without crashing.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:freight_management_mobile/app.dart';

void main() {
  testWidgets('App renders without crashing', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(
      const ProviderScope(
        child: FreightManagementApp(),
      ),
    );

    // Verify the app renders (loading state with logo or similar)
    // The app should at least render without throwing errors
    expect(tester.takeException(), isNull);
  });
}
