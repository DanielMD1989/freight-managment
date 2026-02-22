import { Stack } from "expo-router";

export default function DocumentsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Documents" }} />
    </Stack>
  );
}
