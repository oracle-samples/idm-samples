import { fireEvent, render, screen } from "@testing-library/preact";
import { h } from "preact";

type DialogComponent = (props: {
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) => unknown;

function dialog(): DialogComponent {
  const modulePath = "./index";
  return (require(modulePath) as { VoiceUnenrollmentDialog: DialogComponent })
    .VoiceUnenrollmentDialog;
}

describe("VoiceUnenrollmentDialog", () => {
  it("starts on Cancel and requires explicit destructive confirmation", () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    render(h(dialog() as never, { open: true, busy: false, onCancel, onConfirm }));

    expect(screen.getByRole("dialog", { name: /Delete voice enrollment/i })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: /Delete voice enrollment/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("treats Escape as cancellation and suppresses duplicate confirmation while busy", () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    render(h(dialog() as never, { open: true, busy: true, onCancel, onConfirm }));

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    const confirm = screen.getByRole("button", { name: /Delete voice enrollment/i }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("treats an explicit backdrop dismiss as cancellation", () => {
    const onCancel = jest.fn();
    render(h(dialog() as never, {
      open: true,
      busy: false,
      onCancel,
      onConfirm: jest.fn()
    }));

    fireEvent.click(screen.getByTestId("voice-unenrollment-backdrop"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
