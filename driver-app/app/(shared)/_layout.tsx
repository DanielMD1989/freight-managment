/**
 * Shared Layout - Stack navigator for screens shared across states
 * (pending-approval, account-rejected, chat, settings, profile)
 */
import { Stack } from "expo-router";

export default function SharedLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="pending-approval" />
      <Stack.Screen name="account-rejected" />
      <Stack.Screen name="account-suspended" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}
