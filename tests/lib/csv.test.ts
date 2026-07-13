import { describe, it, expect } from "vitest";
import { toRedmineCsv, formatDate } from "@/lib/csv";

describe("formatDate", () => {
  it("converts ISO to MM/DD/YYYY", () => {
    expect(formatDate("2026-07-13")).toBe("07/13/2026");
  });
  it("returns empty string for null", () => {
    expect(formatDate(null)).toBe("");
  });
});

describe("toRedmineCsv", () => {
  it("writes header in the exact column order", () => {
    const csv = toRedmineCsv([]);
    expect(csv).toBe(
      "Tracker,Subject,Assignee,Due date,Sprint,Parent task,Start date,Description,Priority\r\n",
    );
  });

  it("writes a simple row", () => {
    const csv = toRedmineCsv([
      {
        tracker: "Task_Scr",
        subject: "Hello",
        assignee: "Nguyen Nguyen",
        dueDate: "2026-07-13",
        sprint: "Q3-2026 (Jul 01 - Sep 30)",
        parentTaskId: 114330,
        startDate: "2026-07-13",
        description: null,
        priority: "Normal",
      },
    ]);
    expect(csv).toContain(
      "Task_Scr,Hello,Nguyen Nguyen,07/13/2026,Q3-2026 (Jul 01 - Sep 30),114330,07/13/2026,,Normal\r\n",
    );
  });

  it("quotes fields with commas and doubles quotes inside", () => {
    const csv = toRedmineCsv([
      {
        tracker: "Bug",
        subject: 'Something, with "quotes"',
        assignee: "A",
        dueDate: null,
        sprint: null,
        parentTaskId: null,
        startDate: null,
        description: "Line 1\nLine 2",
        priority: null,
      },
    ]);
    expect(csv).toContain('"Something, with ""quotes""",A,,,,');
    expect(csv).toContain('"Line 1\nLine 2"');
  });

  it("handles Vietnamese characters", () => {
    const csv = toRedmineCsv([
      {
        tracker: "Task_Scr",
        subject: "Thiết kế bảng điều khiển",
        assignee: "Nguyễn",
        dueDate: null,
        sprint: null,
        parentTaskId: null,
        startDate: null,
        description: null,
        priority: null,
      },
    ]);
    expect(csv).toContain("Thiết kế bảng điều khiển");
  });
});
