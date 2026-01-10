import * as React from 'react';

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {}

export function Table({ className = '', children, ...props }: TableProps) {
  return (
    <div className="w-full overflow-auto">
      <table
        className={`w-full caption-bottom text-sm ${className}`}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export function TableHeader({ className = '', children, ...props }: TableHeaderProps) {
  return (
    <thead className={`bg-[#f0fdfa] dark:bg-slate-700 ${className}`} {...props}>
      {children}
    </thead>
  );
}

interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export function TableBody({ className = '', children, ...props }: TableBodyProps) {
  return (
    <tbody className={`divide-y divide-[#064d51]/10 dark:divide-slate-700 ${className}`} {...props}>
      {children}
    </tbody>
  );
}

interface TableFooterProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export function TableFooter({ className = '', children, ...props }: TableFooterProps) {
  return (
    <tfoot
      className={`bg-[#f0fdfa] font-medium dark:bg-slate-800 ${className}`}
      {...props}
    >
      {children}
    </tfoot>
  );
}

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {}

export function TableRow({ className = '', children, ...props }: TableRowProps) {
  return (
    <tr
      className={`transition-colors hover:bg-[#064d51]/5 dark:hover:bg-slate-700/50 ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {}

export function TableHead({ className = '', children, ...props }: TableHeadProps) {
  return (
    <th
      className={`h-12 px-4 text-left align-middle font-medium text-[#064d51] dark:text-gray-400 ${className}`}
      {...props}
    >
      {children}
    </th>
  );
}

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {}

export function TableCell({ className = '', children, ...props }: TableCellProps) {
  return (
    <td
      className={`p-4 align-middle text-[#064d51] dark:text-white ${className}`}
      {...props}
    >
      {children}
    </td>
  );
}

interface TableCaptionProps extends React.HTMLAttributes<HTMLTableCaptionElement> {}

export function TableCaption({ className = '', children, ...props }: TableCaptionProps) {
  return (
    <caption
      className={`mt-4 text-sm text-[#064d51]/70 dark:text-gray-400 ${className}`}
      {...props}
    >
      {children}
    </caption>
  );
}
