import { withAuth } from "next-auth/middleware";

// Coarse gate: must be signed in. Fine-grained role checks happen server-side against the DB
// (see src/lib/session.ts) so role/approval/suspension changes take effect immediately.
export default withAuth({ pages: { signIn: "/login" } });

export const config = {
  matcher: ["/account/:path*", "/seller/:path*", "/admin/:path*", "/sell/apply", "/sell/pending", "/checkout/:path*"],
};
