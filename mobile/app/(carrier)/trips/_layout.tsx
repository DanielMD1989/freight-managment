import { Stack } from "expo-router";

export default function TripsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "My Trips" }} />
      <Stack.Screen name="[id]" options={{ title: "Trip Details" }} />
    </Stack>
  );
}
