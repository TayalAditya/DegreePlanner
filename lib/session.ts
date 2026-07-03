import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Per-request memoized session getter.
 *
 * `getServerSession` is NOT automatically deduplicated by Next.js, so calling
 * it in both the dashboard layout and page decrypts/verifies the JWT (and can
 * hit the DB for the acad-sec path) twice per request. Wrapping it in React's
 * `cache()` memoizes the result for the lifetime of a single server request, so
 * repeated calls within the same render tree reuse the first result.
 */
export const getSession = cache(() => getServerSession(authOptions));
