import { render, screen } from "@testing-library/preact";
import { h } from "preact";
import { LiveRegion } from "./index";

describe("LiveRegion", () => {
  it("exposes polite atomic announcements and updates terminal status text", () => {
    const view = render(<LiveRegion message="Checking voice enrollment status." />);
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.getAttribute("aria-atomic")).toBe("true");

    view.rerender(<LiveRegion message="Voice enrollment status updated." />);
    expect(region.textContent).toBe("Voice enrollment status updated.");

    view.rerender(<LiveRegion />);
    expect(region.textContent).toBe("");
  });
});
