/**
 * Driver Main Layout - Tab navigator placeholder
 * Tabs will be added in Task 24 (Trips, Profile, etc.)
 */
import { Stack } from "expo-router";

export default function DriverLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
