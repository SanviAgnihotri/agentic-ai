"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Better Auth browser client. The session cookie rides along automatically —
 * never pass request headers to these methods.
 */
export const authClient = createAuthClient();
