import { Stack } from "expo-router";

export default function SharedLayout() {
  return (
    <Stack>
      <Stack.Screen name="profile" options={{ title: "Profile" }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      <Stack.Screen name="wallet" options={{ title: "Wallet" }} />
      <Stack.Screen name="team" options={{ title: "Team" }} />
      <Stack.Screen
        name="pending-verification"
        options={{ title: "Account Pending", headerShown: false }}
      />
    </Stack>
  );
}
