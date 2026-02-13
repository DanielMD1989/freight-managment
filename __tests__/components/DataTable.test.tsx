/**
 * @jest-environment jsdom
 */

/**
 * DataTable Component Tests
 *
 * Tests for the DataTable component including:
 * - Rendering data
 * - Empty state
 * - Loading state
 * - Sorting
 * - Selection
 * - Row expansion
 * - Actions
 * - View mode toggle (table/card)
 */

import "@testing-library/jest-dom";
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DataTable from "@/components/loadboard-ui/DataTable";
import { TableColumn, RowAction } from "@/types/loadboard-ui";

// Mock window.matchMedia for responsive tests
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

// Mock TableSkeleton
jest.mock("@/components/loadboard-ui/TableSkeleton", () => {
  return {
    __esModule: true,
    default: function MockTableSkeleton(props: {
      rows: number;
      columns: number;
    }) {
      return (
        <div data-testid="table-skeleton">
          Loading skeleton: {props.rows} rows, {props.columns} columns
        </div>
      );
    },
  };
});

// Sample test data
interface TestRow {
  id: string;
  name: string;
  email: string;
  status: string;
  amount: number;
}

const mockData: TestRow[] = [
  {
    id: "1",
    name: "John Doe",
    email: "john@example.com",
    status: "Active",
    amount: 100,
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane@example.com",
    status: "Pending",
    amount: 200,
  },
  {
    id: "3",
    name: "Bob Wilson",
    email: "bob@example.com",
    status: "Active",
    amount: 150,
  },
];

const mockColumns: TableColumn[] = [
  { key: "name", label: "Name", sortable: true },
  { key: "email", label: "Email", sortable: true },
  { key: "status", label: "Status", sortable: false },
  { key: "amount", label: "Amount", sortable: true, align: "right" },
];

describe("DataTable", () => {
  // ============================================================================
  // BASIC RENDERING
  // ============================================================================
  describe("Basic Rendering", () => {
    it("renders table with data correctly", () => {
      render(<DataTable columns={mockColumns} data={mockData} />);

      // Check table exists
      expect(screen.getByRole("table")).toBeInTheDocument();

      // Check column headers
      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Email")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Amount")).toBeInTheDocument();

      // Check data rows
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("jane@example.com")).toBeInTheDocument();
      // Active appears twice (John and Bob have Active status)
      expect(screen.getAllByText("Active")).toHaveLength(2);
    });

    it("renders item count", () => {
      render(<DataTable columns={mockColumns} data={mockData} />);

      expect(screen.getByText("3 items")).toBeInTheDocument();
    });

    it('renders singular "item" for single row', () => {
      render(<DataTable columns={mockColumns} data={[mockData[0]]} />);

      expect(screen.getByText("1 item")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          className="custom-class"
        />
      );

      expect(container.firstChild).toHaveClass("custom-class");
    });
  });

  // ============================================================================
  // EMPTY STATE
  // ============================================================================
  describe("Empty State", () => {
    it("renders default empty message when no data", () => {
      render(<DataTable columns={mockColumns} data={[]} />);

      // "No data available" appears in both heading and message
      expect(
        screen.getByRole("heading", { name: "No data available" })
      ).toBeInTheDocument();
    });

    it("renders custom empty message", () => {
      render(
        <DataTable
          columns={mockColumns}
          data={[]}
          emptyMessage="No loads found. Try adjusting your filters."
        />
      );

      expect(
        screen.getByText("No loads found. Try adjusting your filters.")
      ).toBeInTheDocument();
    });

    it("does not render table when data is empty", () => {
      render(<DataTable columns={mockColumns} data={[]} />);

      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  describe("Loading State", () => {
    it("renders skeleton when loading", () => {
      render(
        <DataTable columns={mockColumns} data={mockData} loading={true} />
      );

      expect(screen.getByTestId("table-skeleton")).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("passes correct skeleton dimensions", () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          loading={true}
          selectable={true}
          actions={[
            {
              key: "edit",
              label: "Edit",
              variant: "primary",
              onClick: () => {},
            },
          ]}
        />
      );

      // columns + selection column + actions column
      expect(screen.getByText(/6 columns/)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // SORTING
  // ============================================================================
  describe("Sorting", () => {
    it("shows sort indicators on sortable columns", () => {
      render(<DataTable columns={mockColumns} data={mockData} />);

      // Name, Email, Amount are sortable
      const nameHeader = screen.getByRole("columnheader", { name: /name/i });
      expect(nameHeader).toHaveAttribute("aria-sort", "none");
    });

    it("sorts data ascending on first click", async () => {
      const user = userEvent.setup();
      render(<DataTable columns={mockColumns} data={mockData} />);

      const nameHeader = screen.getByRole("columnheader", { name: /name/i });
      await user.click(nameHeader);

      expect(nameHeader).toHaveAttribute("aria-sort", "ascending");

      // Check order - Bob should be first alphabetically
      const rows = screen.getAllByRole("row");
      // First row is header, so data starts at index 1
      expect(within(rows[1]).getByText("Bob Wilson")).toBeInTheDocument();
    });

    it("toggles to descending on second click", async () => {
      const user = userEvent.setup();
      render(<DataTable columns={mockColumns} data={mockData} />);

      const nameHeader = screen.getByRole("columnheader", { name: /name/i });
      await user.click(nameHeader);
      await user.click(nameHeader);

      expect(nameHeader).toHaveAttribute("aria-sort", "descending");

      // John should be first now (reverse alphabetical)
      const rows = screen.getAllByRole("row");
      expect(within(rows[1]).getByText("John Doe")).toBeInTheDocument();
    });

    it("sorts numeric columns correctly", async () => {
      const user = userEvent.setup();
      render(<DataTable columns={mockColumns} data={mockData} />);

      const amountHeader = screen.getByRole("columnheader", {
        name: /amount/i,
      });
      await user.click(amountHeader);

      const rows = screen.getAllByRole("row");
      // Ascending: 100 should be first
      expect(within(rows[1]).getByText("100")).toBeInTheDocument();
    });

    it("does not sort non-sortable columns", async () => {
      const user = userEvent.setup();
      render(<DataTable columns={mockColumns} data={mockData} />);

      const statusHeader = screen.getByRole("columnheader", {
        name: /status/i,
      });
      await user.click(statusHeader);

      // Should remain unsorted
      expect(statusHeader).toHaveAttribute("aria-sort", "none");
    });

    it("handles keyboard sorting with Enter key", async () => {
      const user = userEvent.setup();
      render(<DataTable columns={mockColumns} data={mockData} />);

      const nameHeader = screen.getByRole("columnheader", { name: /name/i });
      nameHeader.focus();
      await user.keyboard("{Enter}");

      expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
    });
  });

  // ============================================================================
  // SELECTION
  // ============================================================================
  describe("Selection", () => {
    it("renders checkboxes when selectable", () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          selectable={true}
          selectedRows={[]}
          onSelectionChange={() => {}}
        />
      );

      // Select-all checkbox + 3 row checkboxes
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(4);
    });

    it("calls onSelectionChange when row is selected", async () => {
      const user = userEvent.setup();
      const onSelectionChange = jest.fn();

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          selectable={true}
          selectedRows={[]}
          onSelectionChange={onSelectionChange}
        />
      );

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[1]); // First row checkbox

      expect(onSelectionChange).toHaveBeenCalledWith(["1"]);
    });

    it("deselects row when already selected", async () => {
      const user = userEvent.setup();
      const onSelectionChange = jest.fn();

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          selectable={true}
          selectedRows={["1", "2"]}
          onSelectionChange={onSelectionChange}
        />
      );

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[1]); // Deselect first row

      expect(onSelectionChange).toHaveBeenCalledWith(["2"]);
    });

    it("selects all rows when select-all is clicked", async () => {
      const user = userEvent.setup();
      const onSelectionChange = jest.fn();

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          selectable={true}
          selectedRows={[]}
          onSelectionChange={onSelectionChange}
        />
      );

      const selectAllCheckbox = screen.getAllByRole("checkbox")[0];
      await user.click(selectAllCheckbox);

      expect(onSelectionChange).toHaveBeenCalledWith(["1", "2", "3"]);
    });

    it("deselects all when all are selected and select-all is clicked", async () => {
      const user = userEvent.setup();
      const onSelectionChange = jest.fn();

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          selectable={true}
          selectedRows={["1", "2", "3"]}
          onSelectionChange={onSelectionChange}
        />
      );

      const selectAllCheckbox = screen.getAllByRole("checkbox")[0];
      await user.click(selectAllCheckbox);

      expect(onSelectionChange).toHaveBeenCalledWith([]);
    });

    it("shows selected row styling", () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          selectable={true}
          selectedRows={["1"]}
          onSelectionChange={() => {}}
        />
      );

      const rows = screen.getAllByRole("row");
      expect(rows[1]).toHaveAttribute("aria-selected", "true");
    });
  });

  // ============================================================================
  // ROW EXPANSION
  // ============================================================================
  describe("Row Expansion", () => {
    const renderExpandedRow = (row: TestRow) => (
      <div data-testid="expanded-content">Details for {row.name}</div>
    );

    it("renders expand buttons when expandable", () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          expandable={true}
          renderExpandedRow={renderExpandedRow}
        />
      );

      const expandButtons = screen.getAllByRole("button", {
        name: /expand row/i,
      });
      expect(expandButtons).toHaveLength(3);
    });

    it("expands row on click", async () => {
      const user = userEvent.setup();

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          expandable={true}
          renderExpandedRow={renderExpandedRow}
        />
      );

      const expandButton = screen.getAllByRole("button", {
        name: /expand row 1/i,
      })[0];
      await user.click(expandButton);

      expect(screen.getByTestId("expanded-content")).toBeInTheDocument();
      expect(screen.getByText("Details for John Doe")).toBeInTheDocument();
    });

    it("collapses row on second click", async () => {
      const user = userEvent.setup();

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          expandable={true}
          renderExpandedRow={renderExpandedRow}
        />
      );

      const expandButton = screen.getAllByRole("button", {
        name: /expand row 1/i,
      })[0];
      await user.click(expandButton);
      await user.click(expandButton);

      expect(screen.queryByTestId("expanded-content")).not.toBeInTheDocument();
    });

    it("supports multiple expanded rows", async () => {
      const user = userEvent.setup();

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          expandable={true}
          renderExpandedRow={renderExpandedRow}
        />
      );

      const expandButtons = screen.getAllByRole("button", {
        name: /expand row/i,
      });
      await user.click(expandButtons[0]);
      await user.click(expandButtons[1]);

      expect(screen.getByText("Details for John Doe")).toBeInTheDocument();
      expect(screen.getByText("Details for Jane Smith")).toBeInTheDocument();
    });

    it("shows aria-expanded state", async () => {
      const user = userEvent.setup();

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          expandable={true}
          renderExpandedRow={renderExpandedRow}
        />
      );

      const expandButton = screen.getAllByRole("button", {
        name: /expand row 1/i,
      })[0];
      expect(expandButton).toHaveAttribute("aria-expanded", "false");

      await user.click(expandButton);
      expect(expandButton).toHaveAttribute("aria-expanded", "true");
    });

    it("supports externally controlled expandedRowIds", () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          expandable={true}
          renderExpandedRow={renderExpandedRow}
          expandedRowIds={["1"]}
        />
      );

      expect(screen.getByText("Details for John Doe")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // ACTIONS
  // ============================================================================
  describe("Actions", () => {
    const mockActions: RowAction[] = [
      {
        key: "edit",
        label: "Edit",
        variant: "primary",
        onClick: jest.fn(),
      },
      {
        key: "delete",
        label: "Delete",
        variant: "destructive",
        onClick: jest.fn(),
      },
    ];

    it("renders action buttons", () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          actions={mockActions}
        />
      );

      expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(3);
      expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(3);
    });

    it("calls action onClick with row data", async () => {
      const user = userEvent.setup();
      const onEdit = jest.fn();
      const actions: RowAction[] = [
        { key: "edit", label: "Edit", variant: "primary", onClick: onEdit },
      ];

      render(
        <DataTable columns={mockColumns} data={mockData} actions={actions} />
      );

      const editButtons = screen.getAllByRole("button", { name: "Edit" });
      await user.click(editButtons[0]);

      expect(onEdit).toHaveBeenCalledWith(mockData[0]);
    });

    it("conditionally shows actions based on show function", () => {
      const actions: RowAction[] = [
        {
          key: "activate",
          label: "Activate",
          variant: "primary",
          onClick: jest.fn(),
          show: (row: TestRow) => row.status === "Pending",
        },
      ];

      render(
        <DataTable columns={mockColumns} data={mockData} actions={actions} />
      );

      // Only Jane Smith has 'Pending' status
      expect(screen.getAllByRole("button", { name: "Activate" })).toHaveLength(
        1
      );
    });

    it("renders Actions column header", () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          actions={mockActions}
        />
      );

      expect(screen.getByText("Actions")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // ROW CLICK
  // ============================================================================
  describe("Row Click", () => {
    it("calls onRowClick when row is clicked", async () => {
      const user = userEvent.setup();
      const onRowClick = jest.fn();

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          onRowClick={onRowClick}
        />
      );

      const rows = screen.getAllByRole("row");
      await user.click(rows[1]); // First data row

      expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
    });
  });

  // ============================================================================
  // CUSTOM CELL RENDERING
  // ============================================================================
  describe("Custom Cell Rendering", () => {
    it("uses custom render function when provided", () => {
      const columnsWithRender: TableColumn[] = [
        ...mockColumns.slice(0, 2),
        {
          key: "status",
          label: "Status",
          render: (value: string) => (
            <span data-testid="custom-status" className="badge">
              {value.toUpperCase()}
            </span>
          ),
        },
        mockColumns[3],
      ];

      render(<DataTable columns={columnsWithRender} data={mockData} />);

      const customStatuses = screen.getAllByTestId("custom-status");
      expect(customStatuses).toHaveLength(3);
      expect(customStatuses[0]).toHaveTextContent("ACTIVE");
    });

    it("handles null and undefined values gracefully", () => {
      const dataWithNulls = [
        { id: "1", name: "Test", email: null, status: undefined, amount: 0 },
      ];

      render(<DataTable columns={mockColumns} data={dataWithNulls} />);

      // Should render without crashing and show empty cells
      expect(screen.getByText("Test")).toBeInTheDocument();
      expect(screen.getByText("0")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // CUSTOM ROW KEY
  // ============================================================================
  describe("Custom Row Key", () => {
    it("uses custom rowKey for selection", async () => {
      const user = userEvent.setup();
      const onSelectionChange = jest.fn();
      const dataWithCustomKey = [
        { uniqueId: "a1", name: "Test 1", email: "", status: "", amount: 0 },
        { uniqueId: "b2", name: "Test 2", email: "", status: "", amount: 0 },
      ];

      render(
        <DataTable
          columns={mockColumns}
          data={dataWithCustomKey}
          rowKey="uniqueId"
          selectable={true}
          selectedRows={[]}
          onSelectionChange={onSelectionChange}
        />
      );

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[1]);

      expect(onSelectionChange).toHaveBeenCalledWith(["a1"]);
    });
  });

  // ============================================================================
  // VIEW MODE TOGGLE
  // ============================================================================
  describe("View Mode Toggle", () => {
    it("renders view toggle buttons when responsiveCardView is enabled", () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          responsiveCardView={true}
        />
      );

      expect(
        screen.getByRole("button", { name: "Table view" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Card view" })
      ).toBeInTheDocument();
    });

    it("switches to card view when card button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          responsiveCardView={true}
        />
      );

      const cardViewButton = screen.getByRole("button", { name: "Card view" });
      await user.click(cardViewButton);

      // Table should no longer be visible
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("switches back to table view when table button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          responsiveCardView={true}
        />
      );

      // Switch to card view
      await user.click(screen.getByRole("button", { name: "Card view" }));

      // Switch back to table view
      await user.click(screen.getByRole("button", { name: "Table view" }));

      expect(screen.getByRole("table")).toBeInTheDocument();
    });

    it("does not render toggle when responsiveCardView is false", () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          responsiveCardView={false}
        />
      );

      expect(
        screen.queryByRole("button", { name: "Card view" })
      ).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // CARD VIEW RENDERING
  // ============================================================================
  describe("Card View", () => {
    it("renders cards with correct data in card view", async () => {
      const user = userEvent.setup();

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          responsiveCardView={true}
          cardTitleColumn="name"
          cardSubtitleColumn="email"
        />
      );

      await user.click(screen.getByRole("button", { name: "Card view" }));

      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("john@example.com")).toBeInTheDocument();
    });

    it("renders selection checkboxes in card view", async () => {
      const user = userEvent.setup();

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          responsiveCardView={true}
          selectable={true}
          selectedRows={[]}
          onSelectionChange={() => {}}
        />
      );

      await user.click(screen.getByRole("button", { name: "Card view" }));

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(3);
    });

    it("renders actions in card view", async () => {
      const user = userEvent.setup();
      const actions: RowAction[] = [
        { key: "edit", label: "Edit", variant: "primary", onClick: jest.fn() },
      ];

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          responsiveCardView={true}
          actions={actions}
        />
      );

      await user.click(screen.getByRole("button", { name: "Card view" }));

      expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(3);
    });

    it("calls onRowClick in card view", async () => {
      const user = userEvent.setup();
      const onRowClick = jest.fn();

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          responsiveCardView={true}
          onRowClick={onRowClick}
        />
      );

      await user.click(screen.getByRole("button", { name: "Card view" }));

      // Click on the card containing John Doe
      const johnDoeCard = screen
        .getByText("John Doe")
        .closest('div[class*="rounded-xl"]');
      if (johnDoeCard) {
        await user.click(johnDoeCard);
        expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
      }
    });
  });

  // ============================================================================
  // ACCESSIBILITY
  // ============================================================================
  describe("Accessibility", () => {
    it("has proper table ARIA roles", () => {
      render(<DataTable columns={mockColumns} data={mockData} />);

      expect(screen.getByRole("table")).toHaveAttribute(
        "aria-label",
        "Data table with sorting and selection"
      );
      expect(screen.getAllByRole("columnheader")).toHaveLength(4);
      expect(screen.getAllByRole("cell").length).toBeGreaterThan(0);
    });

    it("has proper region for table scroll container", () => {
      render(<DataTable columns={mockColumns} data={mockData} />);

      expect(
        screen.getByRole("region", { name: "Data table" })
      ).toBeInTheDocument();
    });

    it("has accessible checkbox labels", () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          selectable={true}
          selectedRows={[]}
          onSelectionChange={() => {}}
        />
      );

      expect(
        screen.getByRole("checkbox", { name: "Select all rows" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", { name: "Select row 1" })
      ).toBeInTheDocument();
    });
  });
});
