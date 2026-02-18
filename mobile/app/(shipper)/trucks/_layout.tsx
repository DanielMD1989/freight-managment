import { Stack } from "expo-router";

export default function TrucksLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Find Trucks" }} />
    </Stack>
  );
}
