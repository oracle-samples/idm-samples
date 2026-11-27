import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { h } from "preact";
import { LoginPage } from "./login-page";

describe("LoginPage", () => {
  it("places initial keyboard focus on the username field", async () => {
    render(<LoginPage busy={false} onSubmit={jest.fn()} />);

    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Username")));
  });

  it("uses persistent labels, masks the password and requires both credentials", () => {
    render(<LoginPage busy={false} onSubmit={jest.fn()} />);
    const username = screen.getByLabelText("Username") as HTMLInputElement;
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    expect(username.autocomplete).toBe("username");
    expect(password.type).toBe("password");
    expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.input(username, { target: { value: "user@example.test" } });
    fireEvent.input(password, { target: { value: "secret" } });
    expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("toggles password visibility without submitting", () => {
    render(<LoginPage busy={false} onSubmit={jest.fn()} />);
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(password.type).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(password.type).toBe("password");
  });

  it("submits once from the keyboard and clears the terminal credential fields", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<LoginPage busy={false} onSubmit={onSubmit} />);

    const username = screen.getByLabelText("Username") as HTMLInputElement;
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    await user.type(username, "user@example.test");
    await user.type(password, "not-a-real-secret{Enter}");

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith("user@example.test", "not-a-real-secret");
    await waitFor(() => expect(username.value).toBe(""));
    expect(password.value).toBe("");
  });

  it("prevents a duplicate in-flight submit, preserves username, and clears password after failure", async () => {
    let reject: (error: Error) => void = () => undefined;
    const onSubmit = jest.fn(() => new Promise<void>((_resolve, rejectPromise) => {
      reject = rejectPromise;
    }));
    render(<LoginPage busy={false} onSubmit={onSubmit} />);
    const username = screen.getByLabelText("Username") as HTMLInputElement;
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    fireEvent.input(username, { target: { value: "user@example.test" } });
    fireEvent.input(password, { target: { value: "secret" } });
    const submit = screen.getByRole("button", { name: "Sign in" });
    fireEvent.click(submit);
    fireEvent.submit(submit.closest("form") as HTMLFormElement);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    reject(new Error("rejected"));
    await waitFor(() => expect(username.value).toBe("user@example.test"));
    expect(password.value).toBe("");
    await waitFor(() => expect(document.activeElement).toBe(username));
  });

  it("announces generic throttling guidance without account detail", () => {
    render(
      <LoginPage
        busy={false}
        message="Too many sign-in attempts. Wait, then submit again."
        retryAfterSeconds={30}
        onSubmit={jest.fn()}
      />
    );
    expect(screen.getByRole("alert").textContent).toContain("30 seconds");
    expect(screen.getByRole("alert").textContent).not.toContain("disabled");
  });

  it("requires a fresh explicit submission after a terminal failure", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn()
      .mockRejectedValueOnce(new Error("rejected"))
      .mockResolvedValueOnce(undefined);
    render(<LoginPage busy={false} onSubmit={onSubmit} />);

    const username = screen.getByLabelText("Username") as HTMLInputElement;
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    await user.type(username, "user@example.test");
    await user.type(password, "first-secret{Enter}");
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    await user.type(password, "second-secret{Enter}");
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit.mock.calls[1]).toEqual(["user@example.test", "second-secret"]);
  });
});
