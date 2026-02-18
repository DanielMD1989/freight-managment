import { Stack } from "expo-router";

export default function LoadsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "My Loads" }} />
      <Stack.Screen name="create" options={{ title: "Create Load" }} />
      <Stack.Screen name="[id]" options={{ title: "Load Details" }} />
    </Stack>
  );
}
