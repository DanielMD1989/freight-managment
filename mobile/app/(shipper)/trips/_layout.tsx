import { Stack } from "expo-router";

export default function TripsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "My Shipments" }} />
      <Stack.Screen name="[id]" options={{ title: "Shipment Details" }} />
    </Stack>
  );
}
