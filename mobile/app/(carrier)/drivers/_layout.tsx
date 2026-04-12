import { Stack } from "expo-router";

export default function DriversLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Drivers" }} />
      <Stack.Screen name="invite" options={{ title: "Invite Driver" }} />
      <Stack.Screen name="[id]" options={{ title: "Driver Details" }} />
    </Stack>
  );
}
