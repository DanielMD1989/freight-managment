import { Stack } from "expo-router";

export default function MatchesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Matching Trucks" }} />
    </Stack>
  );
}
