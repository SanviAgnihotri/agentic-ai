import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/auth";

export async function requireApiUser(): Promise<
  { user: SessionUser } | { response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized user" }, { status: 401 }),
    };
  }
  return { user };
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
