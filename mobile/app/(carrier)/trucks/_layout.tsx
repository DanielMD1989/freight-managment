import { Stack } from "expo-router";

export default function TrucksLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "My Trucks" }} />
      <Stack.Screen name="add" options={{ title: "Add Truck" }} />
      <Stack.Screen name="[id]" options={{ title: "Truck Details" }} />
      <Stack.Screen name="edit" options={{ title: "Edit Truck" }} />
    </Stack>
  );
}
