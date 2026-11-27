export type AppRoute = "LOGIN" | "LANDING" | "ENROLLMENT" | "VERIFICATION";

export function routeFor(pathname: string, authenticated: boolean): AppRoute {
  if (!authenticated) return "LOGIN";
  if (pathname === "/enroll") return "ENROLLMENT";
  if (pathname === "/verify") return "VERIFICATION";
  return pathname === "/login" ? "LANDING" : "LANDING";
}

export function replaceRoute(route: AppRoute): void {
  const pathname = route === "LOGIN" ? "/login" : route === "ENROLLMENT" ? "/enroll" :
    route === "VERIFICATION" ? "/verify" : "/";
  if (window.location.pathname !== pathname) {
    window.history.replaceState({ route }, "", pathname);
  }
}
