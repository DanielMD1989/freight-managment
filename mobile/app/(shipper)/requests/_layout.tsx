import { Stack } from "expo-router";

export default function RequestsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Requests" }} />
      <Stack.Screen name="[id]" options={{ title: "Request Details" }} />
    </Stack>
  );
}
