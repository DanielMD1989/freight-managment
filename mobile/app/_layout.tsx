/**
 * Root Layout - Auth guard, providers, role-based routing
 * Ported from Flutter's app.dart route redirect logic
 */
import React, { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useAuthStore } from "../src/stores/auth";
import { useSettingsStore } from "../src/stores/settings";
import { LoadingSpinner } from "../src/components/LoadingSpinner";
import "../src/i18n/config";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { user, isInitialized, isLoading, initialize } = useAuthStore();
  const { isLoaded, loadSettings, onboardingCompleted } = useSettingsStore();

  // Initialize auth and settings on mount
  useEffect(() => {
    initialize();
    loadSettings();
  }, [initialize, loadSettings]);

  // Redirect based on auth state
  useEffect(() => {
    if (!isInitialized || !isLoaded) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "onboarding";

    if (!user) {
      // Not authenticated
      if (!onboardingCompleted && !inOnboarding) {
        router.replace("/onboarding");
      } else if (!inAuthGroup && !inOnboarding) {
        router.replace("/(auth)/login");
      }
    } else {
      // Authenticated - check status and role
      const status = user.status;

      if (status !== "ACTIVE" && status !== "REGISTERED") {
        // Pending verification - redirect to waiting screen
        if (
          segments[0] !== "(shared)" ||
          (segments as string[])[1] !== "pending-verification"
        ) {
          router.replace("/(shared)/pending-verification");
        }
        return;
      }

      // Role-based routing
      if (inAuthGroup || inOnboarding) {
        const role = user.role;
        if (role === "CARRIER") {
          router.replace("/(carrier)/");
        } else if (role === "SHIPPER") {
          router.replace("/(shipper)/");
        } else {
          router.replace("/(carrier)/"); // Default
        }
      }
    }
  }, [user, isInitialized, isLoaded, segments, onboardingCompleted, router]);

  if (!isInitialized || !isLoaded || isLoading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthGuard>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(carrier)" />
              <Stack.Screen name="(shipper)" />
              <Stack.Screen name="(shared)" />
            </Stack>
          </AuthGuard>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
