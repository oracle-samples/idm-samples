import { replaceRoute, routeFor } from "./app-router";

describe("application route guard", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
    jest.restoreAllMocks();
  });

  it.each(["/", "/enrollment", "/verification", "/unknown"])(
    "routes unauthenticated access to login from %s",
    (pathname) => {
      expect(routeFor(pathname, false)).toBe("LOGIN");
    }
  );

  it.each(["/", "/login", "/enrollment", "/verification", "/unknown"])(
    "routes authenticated access to the landing page from %s",
    (pathname) => {
      expect(routeFor(pathname, true)).toBe("LANDING");
    }
  );

  it("routes authenticated canonical voice pages", () => {
    expect(routeFor("/enroll", true)).toBe("ENROLLMENT");
    expect(routeFor("/verify", true)).toBe("VERIFICATION");
  });

  it("replaces protected browser history instead of pushing a reusable stale route", () => {
    window.history.replaceState({}, "", "/verification");
    const replaceState = jest.spyOn(window.history, "replaceState");
    const pushState = jest.spyOn(window.history, "pushState");

    replaceRoute(routeFor(window.location.pathname, false));

    expect(replaceState).toHaveBeenCalledWith({ route: "LOGIN" }, "", "/login");
    expect(pushState).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/login");
  });

  it("does not rewrite the current canonical route", () => {
    window.history.replaceState({}, "", "/login");
    const replaceState = jest.spyOn(window.history, "replaceState");

    replaceRoute("LOGIN");

    expect(replaceState).not.toHaveBeenCalled();
  });
});
