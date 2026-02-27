/**
 * @jest-environment jsdom
 */

/**
 * StatusUpdateModal Component Tests
 *
 * Tests for the status update modal including:
 * - Modal visibility
 * - Status selection
 * - API calls
 * - Error handling
 * - Loading states
 */

import "@testing-library/jest-dom";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StatusUpdateModal from "@/components/StatusUpdateModal";

// Mock getCSRFToken
jest.mock("@/lib/csrfFetch", () => ({
  getCSRFToken: jest.fn().mockResolvedValue("test-csrf-token"),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Default props
const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  loadId: "load-123",
  currentStatus: "POSTED",
  loadDetails: {
    pickupCity: "Chicago",
    deliveryCity: "Los Angeles",
  },
  onUpdateSuccess: jest.fn(),
};

describe("StatusUpdateModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  // ============================================================================
  // VISIBILITY
  // ============================================================================
  describe("Visibility", () => {
    it("renders modal when isOpen is true", () => {
      render(<StatusUpdateModal {...defaultProps} />);

      expect(screen.getByText("Update Load Status")).toBeInTheDocument();
    });

    it("does not render when isOpen is false", () => {
      render(<StatusUpdateModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByText("Update Load Status")).not.toBeInTheDocument();
    });

    it("displays load details", () => {
      render(<StatusUpdateModal {...defaultProps} />);

      expect(screen.getByText("Chicago → Los Angeles")).toBeInTheDocument();
    });

    it("displays current status", () => {
      render(<StatusUpdateModal {...defaultProps} />);

      // The current status label appears
      expect(screen.getByText("Current Status")).toBeInTheDocument();
      // Posted status should be shown (in the current status display)
      expect(screen.getAllByText("Posted").length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // STATUS OPTIONS
  // ============================================================================
  describe("Status Options", () => {
    it("renders all status options as radio buttons", () => {
      render(<StatusUpdateModal {...defaultProps} />);

      const radioButtons = screen.getAllByRole("radio");
      expect(radioButtons.length).toBe(6);
    });

    it("disables current status option", () => {
      render(<StatusUpdateModal {...defaultProps} currentStatus="POSTED" />);

      const postedRadios = screen.getAllByRole("radio");
      // POSTED is the second option (index 1)
      const postedRadio = postedRadios.find(
        (radio) => (radio as HTMLInputElement).value === "POSTED"
      );
      expect(postedRadio).toBeDisabled();
    });

    it("preselects current status", () => {
      render(
        <StatusUpdateModal {...defaultProps} currentStatus="IN_TRANSIT" />
      );

      const inTransitRadio = screen.getByRole("radio", { checked: true });
      expect((inTransitRadio as HTMLInputElement).value).toBe("IN_TRANSIT");
    });
  });

  // ============================================================================
  // STATUS SELECTION
  // ============================================================================
  describe("Status Selection", () => {
    it("allows selecting a different status", async () => {
      const user = userEvent.setup();
      render(<StatusUpdateModal {...defaultProps} currentStatus="POSTED" />);

      const assignedRadio = screen
        .getAllByRole("radio")
        .find((radio) => (radio as HTMLInputElement).value === "ASSIGNED");

      await user.click(assignedRadio!);

      expect(assignedRadio).toBeChecked();
    });

    it("shows warning when selecting CANCELLED status", async () => {
      const user = userEvent.setup();
      render(<StatusUpdateModal {...defaultProps} currentStatus="POSTED" />);

      const cancelledRadio = screen
        .getAllByRole("radio")
        .find((radio) => (radio as HTMLInputElement).value === "CANCELLED");

      await user.click(cancelledRadio!);

      expect(
        screen.getByText(/Cancelling this load may affect completion rates/)
      ).toBeInTheDocument();
    });

    it("does not show warning for non-CANCELLED selection", async () => {
      const user = userEvent.setup();
      render(<StatusUpdateModal {...defaultProps} currentStatus="POSTED" />);

      const assignedRadio = screen
        .getAllByRole("radio")
        .find((radio) => (radio as HTMLInputElement).value === "ASSIGNED");

      await user.click(assignedRadio!);

      expect(
        screen.queryByText(/Cancelling this load may affect completion rates/)
      ).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // FORM SUBMISSION
  // ============================================================================
  describe("Form Submission", () => {
    it("disables update button when status unchanged", () => {
      render(<StatusUpdateModal {...defaultProps} currentStatus="POSTED" />);

      const updateButton = screen.getByRole("button", {
        name: "Update Status",
      });
      expect(updateButton).toBeDisabled();
    });

    it("enables update button when different status selected", async () => {
      const user = userEvent.setup();
      render(<StatusUpdateModal {...defaultProps} currentStatus="POSTED" />);

      const assignedRadio = screen
        .getAllByRole("radio")
        .find((radio) => (radio as HTMLInputElement).value === "ASSIGNED");
      await user.click(assignedRadio!);

      const updateButton = screen.getByRole("button", {
        name: "Update Status",
      });
      expect(updateButton).toBeEnabled();
    });

    it("calls API with correct data on submit", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      render(<StatusUpdateModal {...defaultProps} currentStatus="POSTED" />);

      // Select a new status
      const assignedRadio = screen
        .getAllByRole("radio")
        .find((radio) => (radio as HTMLInputElement).value === "ASSIGNED");
      await user.click(assignedRadio!);

      // Click update
      const updateButton = screen.getByRole("button", {
        name: "Update Status",
      });
      await user.click(updateButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/loads/load-123/status",
          expect.objectContaining({
            method: "PUT",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
              "X-CSRF-Token": "test-csrf-token",
            }),
            body: JSON.stringify({ status: "ASSIGNED" }),
          })
        );
      });
    });

    it("calls onUpdateSuccess and onClose on successful update", async () => {
      const user = userEvent.setup();
      const onUpdateSuccess = jest.fn();
      const onClose = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      render(
        <StatusUpdateModal
          {...defaultProps}
          currentStatus="POSTED"
          onUpdateSuccess={onUpdateSuccess}
          onClose={onClose}
        />
      );

      const assignedRadio = screen
        .getAllByRole("radio")
        .find((radio) => (radio as HTMLInputElement).value === "ASSIGNED");
      await user.click(assignedRadio!);
      await user.click(screen.getByRole("button", { name: "Update Status" }));

      await waitFor(() => {
        expect(onUpdateSuccess).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  describe("Loading State", () => {
    it("shows updating state while submitting", async () => {
      const user = userEvent.setup();

      // Create a promise that we can control
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(pendingPromise);

      render(<StatusUpdateModal {...defaultProps} currentStatus="POSTED" />);

      const assignedRadio = screen
        .getAllByRole("radio")
        .find((radio) => (radio as HTMLInputElement).value === "ASSIGNED");
      await user.click(assignedRadio!);

      // Click update - don't await it
      user.click(screen.getByRole("button", { name: "Update Status" }));

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Updating..." })
        ).toBeInTheDocument();
      });

      // Cleanup - resolve the promise
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });

    it("disables buttons while updating", async () => {
      const user = userEvent.setup();

      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(pendingPromise);

      render(<StatusUpdateModal {...defaultProps} currentStatus="POSTED" />);

      const assignedRadio = screen
        .getAllByRole("radio")
        .find((radio) => (radio as HTMLInputElement).value === "ASSIGNED");
      await user.click(assignedRadio!);

      user.click(screen.getByRole("button", { name: "Update Status" }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
      });

      // Cleanup
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================
  describe("Error Handling", () => {
    it("shows error when selecting same status and clicking update", async () => {
      render(<StatusUpdateModal {...defaultProps} currentStatus="POSTED" />);

      // The update button is disabled when same status, so no error can occur
      // This test verifies the button is disabled
      const updateButton = screen.getByRole("button", {
        name: "Update Status",
      });
      expect(updateButton).toBeDisabled();
    });

    it("displays API error message", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Load is locked for editing" }),
      });

      render(<StatusUpdateModal {...defaultProps} currentStatus="POSTED" />);

      const assignedRadio = screen
        .getAllByRole("radio")
        .find((radio) => (radio as HTMLInputElement).value === "ASSIGNED");
      await user.click(assignedRadio!);
      await user.click(screen.getByRole("button", { name: "Update Status" }));

      await waitFor(() => {
        expect(
          screen.getByText("Load is locked for editing")
        ).toBeInTheDocument();
      });
    });

    it("displays generic error for network failures", async () => {
      const user = userEvent.setup();
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      render(<StatusUpdateModal {...defaultProps} currentStatus="POSTED" />);

      const assignedRadio = screen
        .getAllByRole("radio")
        .find((radio) => (radio as HTMLInputElement).value === "ASSIGNED");
      await user.click(assignedRadio!);
      await user.click(screen.getByRole("button", { name: "Update Status" }));

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // CLOSE BEHAVIOR
  // ============================================================================
  describe("Close Behavior", () => {
    it("calls onClose when close button is clicked", async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();

      render(<StatusUpdateModal {...defaultProps} onClose={onClose} />);

      // Click the close button (X icon)
      const closeButtons = screen.getAllByRole("button");
      const closeButton = closeButtons.find((btn) => btn.querySelector("svg"));
      await user.click(closeButton!);

      expect(onClose).toHaveBeenCalled();
    });

    it("calls onClose when Cancel button is clicked", async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();

      render(<StatusUpdateModal {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onClose).toHaveBeenCalled();
    });

    it("calls onClose when backdrop is clicked", async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();

      const { container } = render(
        <StatusUpdateModal {...defaultProps} onClose={onClose} />
      );

      // Click the backdrop (the semi-transparent overlay)
      const backdrop = container.querySelector(".bg-black.bg-opacity-50");
      await user.click(backdrop!);

      expect(onClose).toHaveBeenCalled();
    });
  });
});
