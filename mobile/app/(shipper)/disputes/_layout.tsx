import { Stack } from "expo-router";

export default function DisputesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Disputes" }} />
      <Stack.Screen name="[id]" options={{ title: "Dispute Details" }} />
    </Stack>
  );
}
