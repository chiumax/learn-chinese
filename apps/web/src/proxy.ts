export { auth as proxy } from "@/auth";

export const config = {
  matcher: [
    "/((?!api/auth|api/health|login|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js|swe-worker-.*\\.js).*)",
  ],
};
