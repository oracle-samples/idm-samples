import { render, screen, within } from "@testing-library/preact";
import { h } from "preact";
import { ConsentMarkdown } from "./consent-markdown";

describe("ConsentMarkdown", () => {
  it("renders the supported consent structure semantically", () => {
    const { container } = render(<ConsentMarkdown text={`## About voice enrollment

To enable **voice authentication**, we need your permission.

### By accepting, you confirm that:

1. Your voice sample will be collected.
2. A voice profile will be created.

- You can request deletion.
- Privacy terms apply.`} />);

    expect(screen.getByRole("heading", { level: 4, name: "About voice enrollment" })).toBeTruthy();
    expect(screen.getByText("voice authentication").tagName).toBe("STRONG");
    const ordered = container.querySelector("ol");
    expect(ordered).not.toBeNull();
    if (!ordered) {
      throw new Error("Expected ordered consent list");
    }
    expect(within(ordered).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getAllByRole("list")).toHaveLength(2);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("renders HTML, links, and unsupported markdown as inert text", () => {
    const { container } = render(<ConsentMarkdown text={`Do not run <script>alert("x")</script>.

[External link](javascript:alert(1))

![Tracking image](https://example.invalid/pixel.png)`} />);

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(/<script>alert\("x"\)<\/script>/)).toBeTruthy();
    expect(screen.getByText("[External link](javascript:alert(1))")).toBeTruthy();
  });

  it("normalizes literal escaped line endings returned by IAM", () => {
    const { container } = render(<ConsentMarkdown
      text={"## How your voice will be used\\n\\nConsent paragraph.\\n\\n1. First confirmation.\\n2. Second confirmation."}
    />);

    expect(screen.getByRole("heading", { level: 4, name: "How your voice will be used" })).toBeTruthy();
    expect(screen.getByText("Consent paragraph.").tagName).toBe("P");
    expect(container.querySelector("ol")?.children).toHaveLength(2);
    expect(container.textContent).not.toContain("\\n");
  });

  it("renders a single-hash Markdown heading as the primary nested consent heading", () => {
    render(<ConsentMarkdown text={"# Voice Enrollment Consent\n\nReview this statement."} />);

    const heading = screen.getByRole("heading", { level: 3, name: "Voice Enrollment Consent" });
    expect(heading.className).toContain("consent-heading-1");
    expect(screen.queryByText(/^# Voice Enrollment Consent$/)).toBeNull();
  });
});
