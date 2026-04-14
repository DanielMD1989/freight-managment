/**
 * AuthenticatedImage — loads images through the authenticated API client.
 *
 * React Native's <Image> does not send auth headers, so protected files
 * under /api/uploads/... cannot be rendered directly. This component
 * fetches the image via the apiClient (which injects the Bearer token),
 * converts the response to a base64 data URI, and renders it.
 */
import React, { useEffect, useState } from "react";
import {
  View,
  Image,
  ActivityIndicator,
  StyleSheet,
  Text,
  type ImageStyle,
  type StyleProp,
} from "react-native";
import apiClient from "../api/client";
import { colors } from "../theme/colors";

interface AuthenticatedImageProps {
  uri: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: "cover" | "contain" | "stretch";
  placeholder?: React.ReactNode;
}

function mimeFromExtension(uri: string): string {
  const ext = uri.split("?")[0].split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // `global.btoa` is available in Hermes; fall back to Buffer on older runtimes.
  if (typeof btoa === "function") return btoa(binary);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("buffer").Buffer.from(binary, "binary").toString("base64");
}

export function AuthenticatedImage({
  uri,
  style,
  resizeMode = "cover",
  placeholder,
}: AuthenticatedImageProps) {
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDataUri(null);
    setError(false);

    if (!uri) {
      setError(true);
      return;
    }

    apiClient
      .get(uri, { responseType: "arraybuffer" })
      .then((response) => {
        if (cancelled) return;
        const contentType =
          (response.headers?.["content-type"] as string | undefined) ||
          mimeFromExtension(uri);
        const base64 = bufferToBase64(response.data as ArrayBuffer);
        setDataUri(`data:${contentType};base64,${base64}`);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [uri]);

  if (error) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.errorText}>!</Text>
      </View>
    );
  }

  if (!dataUri) {
    return (
      <View style={[styles.placeholder, style]}>
        {placeholder ?? (
          <ActivityIndicator size="small" color={colors.primary600} />
        )}
      </View>
    );
  }

  return (
    <Image source={{ uri: dataUri }} style={style} resizeMode={resizeMode} />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.surfaceVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: colors.textTertiary,
    fontSize: 20,
    fontWeight: "600",
  },
});
