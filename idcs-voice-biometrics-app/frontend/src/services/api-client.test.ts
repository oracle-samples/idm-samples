import { ApiClient } from "./api-client";

describe("ApiClient", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("rejects provider and protocol-relative URLs before any network call", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
    const client = new ApiClient();

    await expect(client.request("https://identity.example.test/oauth2/v1/token"))
      .rejects.toThrow("Only same-origin application API paths are allowed");
    await expect(client.request("//identity.example.test/oauth2/v1/token"))
      .rejects.toThrow("Only same-origin application API paths are allowed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forces same-origin credentials, no-store caching, and redirect rejection", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: { get: (name: string) => name === "X-CSRF-Token" ? "csrf-token" : null }
    });
    global.fetch = fetchMock as typeof fetch;
    const client = new ApiClient();

    await expect(client.request<void>("/api/v1/auth/login-context", { method: "GET" }))
      .resolves.toEqual({ value: undefined, csrfToken: "csrf-token" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/login-context",
      expect.objectContaining({
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error"
      })
    );
  });

  it("announces a protected API 401 so the application can end its local session", async () => {
    const onAuthenticationRequired = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => null }
    }) as typeof fetch;
    const client = new ApiClient(onAuthenticationRequired);

    await expect(client.request("/api/v1/voice/enrollment-attempt", { method: "POST" }))
      .rejects.toMatchObject({ status: 401 });

    expect(onAuthenticationRequired).toHaveBeenCalledTimes(1);
  });

  it("does not treat rejected login credentials as an expired application session", async () => {
    const onAuthenticationRequired = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => null }
    }) as typeof fetch;
    const client = new ApiClient(onAuthenticationRequired);

    await expect(client.request("/api/v1/auth/login", { method: "POST" }))
      .rejects.toMatchObject({ status: 401 });

    expect(onAuthenticationRequired).not.toHaveBeenCalled();
  });
});
