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
import { Alert } from "react-native";
import { useAuthStore } from "../src/stores/auth";
import { useSettingsStore } from "../src/stores/settings";
import { LoadingSpinner } from "../src/components/LoadingSpinner";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { pushService } from "../src/services/push";
import { getNotificationRoute } from "../src/utils/notificationRouting";
import type { NotificationMetadata } from "../src/utils/notificationRouting";
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

  // Register for push notifications when authenticated
  useEffect(() => {
    if (user) {
      pushService.registerForPush().catch(console.error);
    }
  }, [user]);

  // Handle push notification taps — deep link to relevant screen
  useEffect(() => {
    const subscription = pushService.onNotificationResponse((response) => {
      const data = (
        response as {
          notification: {
            request: { content: { data: Record<string, unknown> } };
          };
        }
      ).notification.request.content.data;
      const type = data.type as string | undefined;
      const metadata = data as NotificationMetadata;
      const route = getNotificationRoute(type, metadata, user?.role ?? "");
      if (route) router.push(route as `/${string}`);
    });
    return () => subscription.remove();
  }, [user?.role, router]);

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

      if (status !== "ACTIVE") {
        // REJECTED users get a dedicated screen with rejection reason + resubmit
        if (status === "REJECTED") {
          // G-M4-6: Allow REJECTED users to navigate to profile (for document re-upload)
          // in addition to account-rejected screen
          const allowedForRejected = ["account-rejected", "profile"];
          if (
            segments[0] !== "(shared)" ||
            !allowedForRejected.includes((segments as string[])[1])
          ) {
            router.replace("/(shared)/account-rejected");
          }
          return;
        }
        // REGISTERED, PENDING_VERIFICATION, SUSPENDED → waiting screen
        if (
          segments[0] !== "(shared)" ||
          (segments as string[])[1] !== "pending-verification"
        ) {
          router.replace("/(shared)/pending-verification");
        }
        return;
      }

      // Role-based routing — redirect from auth/onboarding or wrong role layout
      const role = user.role;
      const inCarrierGroup = segments[0] === "(carrier)";
      const inShipperGroup = segments[0] === "(shipper)";
      const inSharedGroup = segments[0] === "(shared)";
      const needsRedirect =
        inAuthGroup ||
        inOnboarding ||
        (role === "SHIPPER" && !inShipperGroup && !inSharedGroup) ||
        (role === "CARRIER" && !inCarrierGroup && !inSharedGroup);

      if (needsRedirect) {
        if (role === "CARRIER") {
          router.replace("/(carrier)/");
        } else if (role === "SHIPPER") {
          router.replace("/(shipper)/");
        } else {
          // DISPATCHER/ADMIN roles are not supported on mobile — log out
          Alert.alert(
            "Unsupported Role",
            "Admin and Dispatcher accounts must use the web app. You will be logged out.",
            [
              {
                text: "OK",
                onPress: () => {
                  useAuthStore.getState().logout();
                },
              },
            ]
          );
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
        <ErrorBoundary>
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
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
