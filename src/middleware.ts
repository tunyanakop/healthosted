import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = [
  "/dashboard",
  "/measurements",
  "/conditions",
  "/visits",
  "/medbook",
  "/labs",
  "/season",
  "/reports",
  "/settings",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasCookie = req.cookies.has("hh_session");

  const isProtected = PROTECTED.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/dashboard") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Обратный редирект (залогинен → /dashboard) живёт в самих страницах:
  // middleware не может проверить сессию в БД и на протухшей cookie дал бы петлю.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/measurements/:path*",
    "/conditions/:path*",
    "/visits/:path*",
    "/medbook/:path*",
    "/labs/:path*",
    "/season/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/login",
    "/register",
  ],
};
