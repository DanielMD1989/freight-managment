/**
 * Root Layout - Driver App
 *
 * DRIVER-only auth guard. Routes:
 *   (auth)   — login, join-carrier (accept invite)
 *   (driver) — main tabs (trips, profile, etc.)
 *   (shared) — chat, settings, pending screens
 */
import React, { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Alert, AppState } from "react-native";
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
    queries: { staleTime: 30000, retry: 2, refetchOnWindowFocus: false },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const {
    user,
    isInitialized,
    isLoading,
    initialize,
    sessionExpiredMessage,
    clearSessionExpired,
    mfaPending,
    mfaExpiresAt,
  } = useAuthStore();
  const { isLoaded, loadSettings } = useSettingsStore();

  // Initialize on mount
  useEffect(() => {
    initialize();
    loadSettings();
  }, [initialize, loadSettings]);

  // Register for push when authenticated
  useEffect(() => {
    if (user) {
      pushService.registerForPush().catch(console.error);
    }
  }, [user]);

  // Handle push notification taps
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
      const route = getNotificationRoute(type, metadata);
      if (route) router.push(route as `/${string}`);
    });
    return () => subscription.remove();
  }, [router]);

  // Session expired alert
  useEffect(() => {
    if (sessionExpiredMessage) {
      Alert.alert("Session Expired", sessionExpiredMessage, [
        { text: "OK", onPress: clearSessionExpired },
      ]);
    }
  }, [sessionExpiredMessage, clearSessionExpired]);

  // MFA timeout cleanup
  useEffect(() => {
    if (!mfaPending || !mfaExpiresAt) return;
    const timeoutMs = mfaExpiresAt - Date.now();
    if (timeoutMs <= 0) {
      useAuthStore.getState().clearMfaState();
      return;
    }
    const timer = setTimeout(() => {
      useAuthStore.getState().clearMfaState();
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, [mfaPending, mfaExpiresAt]);

  // Clear MFA on background
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background" || nextState === "inactive") {
        const { mfaPassword } = useAuthStore.getState();
        if (mfaPassword) {
          useAuthStore.getState().clearMfaState();
        }
      }
    });
    return () => subscription.remove();
  }, []);

  // Routing logic
  useEffect(() => {
    if (!isInitialized || !isLoaded) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!user) {
      // Not authenticated → auth screens
      if (!inAuthGroup) {
        router.replace("/(auth)/login");
      }
    } else {
      // Authenticated — enforce DRIVER role
      if (user.role !== "DRIVER") {
        Alert.alert(
          "Wrong App",
          "This app is for drivers only. Please use the FreightET Carrier or Shipper app.",
          [
            {
              text: "Log Out",
              onPress: () => useAuthStore.getState().logout(),
            },
          ]
        );
        return;
      }

      const status = user.status;

      // INVITED → join-carrier flow (hasn't accepted invite yet)
      if (status === "INVITED") {
        if (
          segments[0] !== "(auth)" ||
          (segments as string[])[1] !== "join-carrier"
        ) {
          router.replace("/(auth)/join-carrier");
        }
        return;
      }

      // PENDING_VERIFICATION → waiting for carrier approval
      if (status === "PENDING_VERIFICATION") {
        if (
          segments[0] !== "(shared)" ||
          (segments as string[])[1] !== "pending-approval"
        ) {
          router.replace("/(shared)/pending-approval");
        }
        return;
      }

      // REJECTED
      if (status === "REJECTED") {
        if (
          segments[0] !== "(shared)" ||
          (segments as string[])[1] !== "account-rejected"
        ) {
          router.replace("/(shared)/account-rejected");
        }
        return;
      }

      // SUSPENDED
      if (status === "SUSPENDED") {
        if (
          segments[0] !== "(shared)" ||
          (segments as string[])[1] !== "account-suspended"
        ) {
          router.replace("/(shared)/account-suspended");
        }
        return;
      }

      // ACTIVE → main driver screens
      if (status === "ACTIVE") {
        const inDriverGroup = segments[0] === "(driver)";
        const inSharedGroup = segments[0] === "(shared)";
        if (inAuthGroup) {
          router.replace("/(driver)/");
        } else if (!inDriverGroup && !inSharedGroup) {
          router.replace("/(driver)/");
        }
      }
    }
  }, [user, isInitialized, isLoaded, segments, router]);

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
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(driver)" />
                <Stack.Screen name="(shared)" />
              </Stack>
            </AuthGuard>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
