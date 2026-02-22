import { Stack } from "expo-router";

export default function MyPostingsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "My Postings" }} />
      <Stack.Screen name="[id]" options={{ title: "Posting Details" }} />
    </Stack>
  );
}
