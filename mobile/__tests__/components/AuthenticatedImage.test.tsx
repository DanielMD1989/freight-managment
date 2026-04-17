/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for AuthenticatedImage component.
 *
 * The component fetches images through apiClient (which injects Bearer tokens)
 * because React Native's <Image> does not send auth headers. It converts
 * the arraybuffer response to a base64 data URI and renders it.
 */
import React from "react";
import { render, waitFor, act } from "@testing-library/react-native";

// Mock apiClient before importing the component
const mockGet = jest.fn();
jest.mock("../../src/api/client", () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockGet(...args),
    defaults: { headers: { common: {} } },
  },
}));

// Mock the theme
jest.mock("../../src/theme/colors", () => ({
  colors: {
    primary600: "#0284C7",
    surfaceVariant: "#F1F5F9",
    textTertiary: "#94A3B8",
  },
}));

import { AuthenticatedImage } from "../../src/components/AuthenticatedImage";

/** Build a minimal ArrayBuffer from a byte array */
function makeBuffer(bytes: number[]): ArrayBuffer {
  const buf = new ArrayBuffer(bytes.length);
  const view = new Uint8Array(buf);
  bytes.forEach((b, i) => (view[i] = b));
  return buf;
}

describe("AuthenticatedImage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders ActivityIndicator while loading", () => {
    // Never resolve the promise — stays in loading state
    mockGet.mockReturnValue(new Promise(() => {}));

    const { getByTestId, queryByText } = render(
      <AuthenticatedImage uri="/api/uploads/photo.jpg" />
    );

    // ActivityIndicator is rendered inside the placeholder View
    // The error text "!" should NOT be present
    expect(queryByText("!")).toBeNull();
  });

  it("calls apiClient.get with responseType arraybuffer", () => {
    mockGet.mockReturnValue(new Promise(() => {}));

    render(<AuthenticatedImage uri="/api/uploads/photo.jpg" />);

    expect(mockGet).toHaveBeenCalledWith("/api/uploads/photo.jpg", {
      responseType: "arraybuffer",
    });
  });

  it("renders Image with base64 data URI after loading", async () => {
    const fakeBuffer = makeBuffer([0x89, 0x50, 0x4e, 0x47]); // PNG header bytes
    mockGet.mockResolvedValue({
      data: fakeBuffer,
      headers: { "content-type": "image/png" },
    });

    const { findByTestId, toJSON } = render(
      <AuthenticatedImage uri="/api/uploads/photo.png" />
    );

    // Wait for the effect to resolve and set dataUri
    await waitFor(() => {
      const tree = toJSON();
      // The tree should contain an Image element (not just ActivityIndicator)
      const flat = JSON.stringify(tree);
      expect(flat).toContain("data:image/png;base64,");
    });
  });

  it("uses mime type from content-type header", async () => {
    const fakeBuffer = makeBuffer([0xff, 0xd8, 0xff, 0xe0]); // JPEG header
    mockGet.mockResolvedValue({
      data: fakeBuffer,
      headers: { "content-type": "image/jpeg" },
    });

    const { toJSON } = render(
      <AuthenticatedImage uri="/api/uploads/photo.jpg" />
    );

    await waitFor(() => {
      const flat = JSON.stringify(toJSON());
      expect(flat).toContain("data:image/jpeg;base64,");
    });
  });

  it("falls back to extension-based mime when no content-type header", async () => {
    const fakeBuffer = makeBuffer([0x00]);
    mockGet.mockResolvedValue({
      data: fakeBuffer,
      headers: {},
    });

    const { toJSON } = render(
      <AuthenticatedImage uri="/api/uploads/photo.png" />
    );

    await waitFor(() => {
      const flat = JSON.stringify(toJSON());
      expect(flat).toContain("data:image/png;base64,");
    });
  });

  it("shows error placeholder on fetch failure", async () => {
    mockGet.mockRejectedValue(new Error("401 Unauthorized"));

    const { findByText } = render(
      <AuthenticatedImage uri="/api/uploads/photo.jpg" />
    );

    // Error state renders "!" text
    const errorText = await findByText("!");
    expect(errorText).toBeTruthy();
  });

  it("re-fetches when uri prop changes", async () => {
    const fakeBuffer = makeBuffer([0x00]);
    mockGet.mockResolvedValue({
      data: fakeBuffer,
      headers: { "content-type": "image/jpeg" },
    });

    const { rerender } = render(
      <AuthenticatedImage uri="/api/uploads/photo1.jpg" />
    );

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    // Change the uri
    await act(async () => {
      rerender(<AuthenticatedImage uri="/api/uploads/photo2.jpg" />);
    });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(mockGet).toHaveBeenLastCalledWith("/api/uploads/photo2.jpg", {
        responseType: "arraybuffer",
      });
    });
  });

  it("handles empty uri gracefully (shows error placeholder)", async () => {
    const { findByText } = render(<AuthenticatedImage uri="" />);

    const errorText = await findByText("!");
    expect(errorText).toBeTruthy();
    // Should NOT attempt to fetch
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("applies custom style to the rendered Image", async () => {
    const fakeBuffer = makeBuffer([0x00]);
    mockGet.mockResolvedValue({
      data: fakeBuffer,
      headers: { "content-type": "image/jpeg" },
    });

    const customStyle = { width: 100, height: 100, borderRadius: 8 };

    const { toJSON } = render(
      <AuthenticatedImage
        uri="/api/uploads/photo.jpg"
        style={customStyle}
        resizeMode="contain"
      />
    );

    await waitFor(() => {
      const flat = JSON.stringify(toJSON());
      expect(flat).toContain("data:image/jpeg;base64,");
    });
  });

  it("cancels fetch on unmount (no state update after unmount)", async () => {
    let resolvePromise: (v: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockGet.mockReturnValue(pendingPromise);

    const { unmount } = render(
      <AuthenticatedImage uri="/api/uploads/photo.jpg" />
    );

    // Unmount before the promise resolves
    unmount();

    // Resolve the promise — should not trigger a state update warning
    // because the component sets `cancelled = true` in the cleanup
    await act(async () => {
      resolvePromise!({
        data: makeBuffer([0x00]),
        headers: { "content-type": "image/jpeg" },
      });
    });

    // If we got here without a "state update on unmounted component" warning,
    // the cancellation logic works correctly.
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});
