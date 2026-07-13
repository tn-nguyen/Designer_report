export type CsvTaskRow = {
  tracker: string;
  subject: string;
  assignee: string;
  dueDate: string | null;
  sprint: string | null;
  parentTaskId: number | null;
  startDate: string | null;
  description: string | null;
  priority: string | null;
};

const HEADER = [
  "Tracker",
  "Subject",
  "Assignee",
  "Due date",
  "Sprint",
  "Parent task",
  "Start date",
  "Description",
  "Priority",
];

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  // Expect "YYYY-MM-DD"
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${m}/${d}/${y}`;
}

function escape(value: string): string {
  if (value === "") return "";
  const needsQuote = /[",\r\n]/.test(value);
  if (!needsQuote) return value;
  return '"' + value.replace(/"/g, '""') + '"';
}

function rowToLine(r: CsvTaskRow): string {
  return [
    escape(r.tracker),
    escape(r.subject),
    escape(r.assignee),
    escape(formatDate(r.dueDate)),
    escape(r.sprint ?? ""),
    escape(r.parentTaskId != null ? String(r.parentTaskId) : ""),
    escape(formatDate(r.startDate)),
    escape(r.description ?? ""),
    escape(r.priority ?? ""),
  ].join(",");
}

export function toRedmineCsv(rows: CsvTaskRow[]): string {
  const lines = [HEADER.join(","), ...rows.map(rowToLine)];
  return lines.join("\r\n") + "\r\n";
}
