/**
 * Auth Layout - Stack navigator for login and join-carrier screens
 */
import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="join-carrier" />
    </Stack>
  );
}
