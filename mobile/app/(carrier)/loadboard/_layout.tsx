import { Stack } from "expo-router";

export default function LoadboardLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Find Loads" }} />
      <Stack.Screen name="[id]" options={{ title: "Load Details" }} />
    </Stack>
  );
}
