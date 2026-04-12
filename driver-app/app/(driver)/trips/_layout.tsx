import { Stack } from "expo-router";

export default function TripsLayout() {
  return (
    <Stack>
      <Stack.Screen name="[id]" options={{ title: "Trip Details" }} />
    </Stack>
  );
}
