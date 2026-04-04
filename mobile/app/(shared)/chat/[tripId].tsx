/**
 * Trip Chat Screen — §13 In-App Messaging
 *
 * Real-time messaging between shipper and carrier on a trip.
 * Polls every 5 seconds. Read-only after COMPLETED/CANCELLED.
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { useAuthStore } from "../../../src/stores/auth";
import {
  useTripMessages,
  useSendMessage,
} from "../../../src/hooks/useMessages";
import type { Message } from "../../../src/services/messaging";

export default function ChatScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const user = useAuthStore((s) => s.user);
  const [text, setText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const { data, isLoading, error } = useTripMessages(tripId, {
    refetchInterval: 5000,
  });
  const sendMessage = useSendMessage();

  const messages = data?.messages ?? [];
  const readOnly = data?.readOnly ?? false;

  // Auto-scroll on new messages
  const prevCount = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevCount.current) {
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100
      );
    }
    prevCount.current = messages.length;
  }, [messages.length]);

  const handleSend = useCallback(() => {
    const content = text.trim();
    if (!content || !tripId || readOnly) return;
    sendMessage.mutate({ tripId, data: { content } });
    setText("");
  }, [text, tripId, readOnly, sendMessage]);

  const isMyMessage = (msg: Message) => msg.senderId === user?.id;

  const renderMessage = ({ item }: { item: Message }) => {
    const mine = isMyMessage(item);
    const senderName = item.sender
      ? `${item.sender.firstName || ""} ${item.sender.lastName || ""}`.trim()
      : item.senderRole;

    return (
      <View
        style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
      >
        {!mine && <Text style={styles.senderName}>{senderName}</Text>}
        <Text style={[styles.messageText, mine && styles.messageTextMine]}>
          {item.content}
        </Text>
        <Text style={[styles.time, mine && styles.timeMine]}>
          {new Date(item.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary500} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load messages</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {messages.length === 0 ? (
        <View style={styles.center}>
          <Ionicons
            name="chatbubbles-outline"
            size={48}
            color={colors.slate300}
          />
          <Text style={styles.emptyText}>No messages yet</Text>
          {!readOnly && (
            <Text style={styles.emptySubtext}>
              Start the conversation below
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
        />
      )}

      {readOnly ? (
        <View style={styles.readOnlyBar}>
          <Text style={styles.readOnlyText}>
            Chat is read-only for completed trips
          </Text>
        </View>
      ) : (
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor={colors.slate400}
            multiline
            maxLength={2000}
          />
          <Pressable
            onPress={handleSend}
            disabled={!text.trim() || sendMessage.isPending}
            style={[
              styles.sendButton,
              (!text.trim() || sendMessage.isPending) &&
                styles.sendButtonDisabled,
            ]}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate50,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
  },
  messageList: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  bubble: {
    maxWidth: "80%",
    padding: spacing.sm,
    borderRadius: 12,
    marginBottom: spacing.xs,
  },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary500,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  senderName: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: colors.primary700,
    marginBottom: 2,
  },
  messageText: {
    fontSize: 14,
    color: colors.slate800,
    lineHeight: 20,
  },
  messageTextMine: {
    color: "#fff",
  },
  time: {
    fontSize: 10,
    color: colors.slate400,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  timeMine: {
    color: "rgba(255,255,255,0.7)",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
    backgroundColor: "#fff",
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    maxHeight: 100,
    color: colors.slate800,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary500,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: colors.slate300,
  },
  readOnlyBar: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
    backgroundColor: colors.slate100,
    alignItems: "center",
  },
  readOnlyText: {
    fontSize: 14,
    color: colors.slate500,
  },
  emptyText: {
    fontSize: 16,
    color: colors.slate500,
    fontWeight: "500" as const,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.slate400,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
  },
});
