/**
 * @jest-environment jsdom
 */

/**
 * SearchLoadsTab Component Tests
 *
 * Tests for the carrier search loads tab including:
 * - Basic rendering
 * - Search form toggle
 * - Filter interactions
 * - API calls
 * - Load results display
 * - Saved searches
 */

import "@testing-library/jest-dom";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchLoadsTab from "@/app/carrier/loadboard/SearchLoadsTab";

// Mock dependencies
jest.mock("@/lib/csrfFetch", () => ({
  getCSRFToken: jest.fn().mockResolvedValue("test-csrf-token"),
}));

jest.mock("@/lib/geo", () => ({
  calculateDistanceKm: jest.fn().mockReturnValue(100),
}));

// Mock loadboard-ui components
jest.mock("@/components/loadboard-ui", () => ({
  StatusTabs: function MockStatusTabs() {
    return <div data-testid="status-tabs">StatusTabs</div>;
  },
  AgeIndicator: function MockAgeIndicator({ date }: { date: string }) {
    return <span data-testid="age-indicator">{date}</span>;
  },
  SavedSearches: function MockSavedSearches({
    searches,
    onSelect,
  }: {
    searches: { id: string; name: string }[];
    onSelect: (id: string) => void;
  }) {
    return (
      <div data-testid="saved-searches">
        {searches.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            data-testid={`saved-search-${s.id}`}
          >
            {s.name}
          </button>
        ))}
      </div>
    );
  },
  EditSearchModal: function MockEditSearchModal() {
    return null;
  },
}));

// Mock DataTable
jest.mock("@/components/loadboard-ui/DataTable", () => {
  return {
    __esModule: true,
    default: function MockDataTable({
      data,
      loading,
      emptyMessage,
    }: {
      data: unknown[];
      loading: boolean;
      emptyMessage: string;
    }) {
      if (loading) return <div data-testid="loading">Loading...</div>;
      if (data.length === 0)
        return <div data-testid="empty-state">{emptyMessage}</div>;
      return <div data-testid="data-table">{data.length} loads</div>;
    },
  };
});

// Mock LoadRequestModal
jest.mock("@/app/carrier/loadboard/LoadRequestModal", () => {
  return {
    __esModule: true,
    default: function MockLoadRequestModal() {
      return null;
    },
  };
});

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock user prop
const mockUser = {
  id: "user-123",
  companyId: "company-123",
  name: "Test Carrier",
  email: "carrier@test.com",
  role: "CARRIER" as const,
};

describe("SearchLoadsTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/load-requests")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ loadRequests: [] }),
        });
      }
      if (url.includes("/api/ethiopian-locations")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              locations: [
                {
                  id: "1",
                  name: "Addis Ababa",
                  region: "AA",
                  latitude: 9.02,
                  longitude: 38.75,
                },
                {
                  id: "2",
                  name: "Dire Dawa",
                  region: "DD",
                  latitude: 9.6,
                  longitude: 41.85,
                },
              ],
            }),
        });
      }
      if (url.includes("/api/saved-searches")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ searches: [] }),
        });
      }
      if (url.includes("/api/loads")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ loads: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  // ============================================================================
  // BASIC RENDERING
  // ============================================================================
  describe("Basic Rendering", () => {
    it("renders the component header", async () => {
      render(<SearchLoadsTab user={mockUser} />);

      await waitFor(() => {
        expect(screen.getByText("Search Loads")).toBeInTheDocument();
        expect(
          screen.getByText("Find available loads matching your trucks")
        ).toBeInTheDocument();
      });
    });

    it("renders the New Load Search button", async () => {
      render(<SearchLoadsTab user={mockUser} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /New Load Search/i })
        ).toBeInTheDocument();
      });
    });

    it("shows empty state when no loads", async () => {
      render(<SearchLoadsTab user={mockUser} />);

      await waitFor(() => {
        expect(screen.getByTestId("empty-state")).toBeInTheDocument();
      });
    });

    it("shows results header with load count", async () => {
      render(<SearchLoadsTab user={mockUser} />);

      await waitFor(() => {
        expect(screen.getByText(/0 Loads Found/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // SEARCH FORM
  // ============================================================================
  describe("Search Form", () => {
    it("shows search form when button is clicked", async () => {
      const user = userEvent.setup();
      render(<SearchLoadsTab user={mockUser} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /New Load Search/i })
        ).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("button", { name: /New Load Search/i })
      );

      await waitFor(() => {
        expect(screen.getByText("Truck")).toBeInTheDocument();
        expect(screen.getByText("Origin")).toBeInTheDocument();
        expect(screen.getByText("Destination")).toBeInTheDocument();
      });
    });

    it("hides search form when button is clicked again", async () => {
      const user = userEvent.setup();
      render(<SearchLoadsTab user={mockUser} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /New Load Search/i })
        ).toBeInTheDocument();
      });

      // Show form
      await user.click(
        screen.getByRole("button", { name: /New Load Search/i })
      );

      await waitFor(() => {
        expect(screen.getByText("Truck")).toBeInTheDocument();
      });

      // Hide form
      await user.click(screen.getByRole("button", { name: /Hide Search/i }));

      await waitFor(() => {
        expect(screen.queryByText("DH-O")).not.toBeInTheDocument();
      });
    });

    it("shows Save Search button when form is visible", async () => {
      const user = userEvent.setup();
      render(<SearchLoadsTab user={mockUser} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /New Load Search/i })
        ).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("button", { name: /New Load Search/i })
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Save Search/i })
        ).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // API CALLS
  // ============================================================================
  describe("API Calls", () => {
    it("fetches Ethiopian locations on mount", async () => {
      render(<SearchLoadsTab user={mockUser} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/ethiopian-locations");
      });
    });

    it("fetches saved searches on mount", async () => {
      render(<SearchLoadsTab user={mockUser} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/saved-searches?type=LOADS"
        );
      });
    });

    it("fetches pending load requests on mount", async () => {
      render(<SearchLoadsTab user={mockUser} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/load-requests?status=PENDING"
        );
      });
    });

    it("fetches loads when search is clicked", async () => {
      const user = userEvent.setup();
      render(<SearchLoadsTab user={mockUser} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /New Load Search/i })
        ).toBeInTheDocument();
      });

      // Show form and click search
      await user.click(
        screen.getByRole("button", { name: /New Load Search/i })
      );

      await waitFor(() => {
        // Find the search button in the form (has "Search" text without "New Load" or "Hide")
        const searchButtons = screen.getAllByRole("button");
        const searchButton = searchButtons.find(
          (btn) => btn.textContent?.trim() === "Search"
        );
        expect(searchButton).toBeInTheDocument();
      });

      const searchButtons = screen.getAllByRole("button");
      const searchButton = searchButtons.find(
        (btn) => btn.textContent?.trim() === "Search"
      );
      await user.click(searchButton!);

      await waitFor(() => {
        const loadsCalls = mockFetch.mock.calls.filter((call: unknown[]) =>
          (call[0] as string).includes("/api/loads")
        );
        expect(loadsCalls.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================================
  // FILTERS
  // ============================================================================
  describe("Filters", () => {
    it("has truck type ANY/ONLY toggle buttons", async () => {
      const user = userEvent.setup();
      render(<SearchLoadsTab user={mockUser} />);

      await user.click(
        screen.getByRole("button", { name: /New Load Search/i })
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "ANY" })).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: "ONLY" })
        ).toBeInTheDocument();
      });
    });

    it("has clear button that resets filters", async () => {
      const user = userEvent.setup();
      render(<SearchLoadsTab user={mockUser} />);

      await user.click(
        screen.getByRole("button", { name: /New Load Search/i })
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Clear/i })
        ).toBeInTheDocument();
      });
    });

    it("populates origin dropdown with Ethiopian cities", async () => {
      const user = userEvent.setup();
      render(<SearchLoadsTab user={mockUser} />);

      await user.click(
        screen.getByRole("button", { name: /New Load Search/i })
      );

      // Wait for cities to load - they appear as options in dropdowns
      await waitFor(
        () => {
          const options = screen.getAllByRole("option");
          const addisOption = options.find(
            (opt) => opt.textContent === "Addis Ababa"
          );
          expect(addisOption).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  // ============================================================================
  // RESULTS TABS
  // ============================================================================
  describe("Results Tabs", () => {
    it("renders ALL, PREFERRED, BLOCKED tabs", async () => {
      render(<SearchLoadsTab user={mockUser} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "ALL" })).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: "PREFERRED" })
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: "BLOCKED" })
        ).toBeInTheDocument();
      });
    });

    it("ALL tab is active by default", async () => {
      render(<SearchLoadsTab user={mockUser} />);

      await waitFor(() => {
        const allTab = screen.getByRole("button", { name: "ALL" });
        expect(allTab).toHaveClass("bg-white", "text-teal-700");
      });
    });
  });

  // ============================================================================
  // SAVED SEARCHES
  // ============================================================================
  describe("Saved Searches", () => {
    it("shows saved searches section when searches exist", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/saved-searches")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                searches: [
                  {
                    id: "s1",
                    name: "Addis to Dire",
                    criteria: {},
                    type: "LOADS",
                  },
                ],
              }),
          });
        }
        // Default responses for other endpoints
        if (url.includes("/api/ethiopian-locations")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ locations: [] }),
          });
        }
        if (url.includes("/api/load-requests")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ loadRequests: [] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(<SearchLoadsTab user={mockUser} />);

      await waitFor(() => {
        expect(screen.getByText(/Saved Searches/i)).toBeInTheDocument();
      });
    });

    it("hides saved searches section when no searches", async () => {
      render(<SearchLoadsTab user={mockUser} />);

      await waitFor(() => {
        // Should not show "Saved Searches" heading
        expect(screen.queryByText(/Saved Searches \(/)).not.toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // LOADING STATES
  // ============================================================================
  describe("Loading States", () => {
    it("shows loading state while fetching loads", async () => {
      const user = userEvent.setup();

      // Make the loads API slow
      let resolveLoads: (value: unknown) => void;
      const loadsPromise = new Promise((resolve) => {
        resolveLoads = resolve;
      });

      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/loads?")) {
          return loadsPromise;
        }
        if (url.includes("/api/ethiopian-locations")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ locations: [] }),
          });
        }
        if (url.includes("/api/saved-searches")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ searches: [] }),
          });
        }
        if (url.includes("/api/load-requests")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ loadRequests: [] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(<SearchLoadsTab user={mockUser} />);

      await user.click(
        screen.getByRole("button", { name: /New Load Search/i })
      );

      await waitFor(() => {
        const searchButtons = screen.getAllByRole("button");
        const searchButton = searchButtons.find(
          (btn) => btn.textContent?.trim() === "Search"
        );
        expect(searchButton).toBeInTheDocument();
      });

      // Get the search button
      const searchButtons = screen.getAllByRole("button");
      const searchButton = searchButtons.find(
        (btn) => btn.textContent?.trim() === "Search"
      );

      // Click search but don't await
      user.click(searchButton!);

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toBeInTheDocument();
      });

      // Resolve the promise
      resolveLoads!({
        ok: true,
        json: () => Promise.resolve({ loads: [] }),
      });
    });
  });

  // ============================================================================
  // LOAD RESULTS
  // ============================================================================
  describe("Load Results", () => {
    it("displays loads when search returns results", async () => {
      const user = userEvent.setup();

      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/loads?")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                loads: [
                  {
                    id: "load-1",
                    pickupCity: "Addis Ababa",
                    deliveryCity: "Dire Dawa",
                    weight: 10000,
                    truckType: "FLATBED",
                    status: "POSTED",
                    createdAt: new Date().toISOString(),
                  },
                  {
                    id: "load-2",
                    pickupCity: "Bahir Dar",
                    deliveryCity: "Mekelle",
                    weight: 5000,
                    truckType: "DRY_VAN",
                    status: "POSTED",
                    createdAt: new Date().toISOString(),
                  },
                ],
              }),
          });
        }
        if (url.includes("/api/ethiopian-locations")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ locations: [] }),
          });
        }
        if (url.includes("/api/saved-searches")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ searches: [] }),
          });
        }
        if (url.includes("/api/load-requests")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ loadRequests: [] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(<SearchLoadsTab user={mockUser} />);

      await user.click(
        screen.getByRole("button", { name: /New Load Search/i })
      );

      await waitFor(() => {
        const searchButtons = screen.getAllByRole("button");
        const searchButton = searchButtons.find(
          (btn) => btn.textContent?.trim() === "Search"
        );
        expect(searchButton).toBeInTheDocument();
      });

      const searchButtons = screen.getAllByRole("button");
      const searchButton = searchButtons.find(
        (btn) => btn.textContent?.trim() === "Search"
      );
      await user.click(searchButton!);

      await waitFor(() => {
        expect(screen.getByTestId("data-table")).toBeInTheDocument();
        expect(screen.getByText("2 loads")).toBeInTheDocument();
      });
    });

    it("updates load count in header", async () => {
      const user = userEvent.setup();

      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/loads?")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                loads: [
                  {
                    id: "load-1",
                    status: "POSTED",
                    createdAt: new Date().toISOString(),
                  },
                  {
                    id: "load-2",
                    status: "POSTED",
                    createdAt: new Date().toISOString(),
                  },
                  {
                    id: "load-3",
                    status: "POSTED",
                    createdAt: new Date().toISOString(),
                  },
                ],
              }),
          });
        }
        if (url.includes("/api/ethiopian-locations")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ locations: [] }),
          });
        }
        if (url.includes("/api/saved-searches")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ searches: [] }),
          });
        }
        if (url.includes("/api/load-requests")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ loadRequests: [] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(<SearchLoadsTab user={mockUser} />);

      await user.click(
        screen.getByRole("button", { name: /New Load Search/i })
      );

      await waitFor(() => {
        const searchButtons = screen.getAllByRole("button");
        const searchButton = searchButtons.find(
          (btn) => btn.textContent?.trim() === "Search"
        );
        expect(searchButton).toBeInTheDocument();
      });

      const searchButtons = screen.getAllByRole("button");
      const searchButton = searchButtons.find(
        (btn) => btn.textContent?.trim() === "Search"
      );
      await user.click(searchButton!);

      await waitFor(() => {
        expect(screen.getByText(/3 Loads Found/i)).toBeInTheDocument();
      });
    });
  });
});
