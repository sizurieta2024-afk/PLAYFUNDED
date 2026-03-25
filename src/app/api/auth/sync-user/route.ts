import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { syncAppUserFromAuthUser } from "@/lib/auth-user-sync";
import { PENDING_VERIFICATION_COOKIE } from "@/lib/auth-verification";

export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  try {
    await syncAppUserFromAuthUser(user);
    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: PENDING_VERIFICATION_COOKIE,
      value: "",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (syncError) {
    console.error("[api/auth/sync-user] sync failed:", syncError);
    return NextResponse.json({ error: "sync_failed" }, { status: 500 });
  }
}
