import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProfileRedirectPage() {
  const auth = await getCurrentUser();
  if (!auth) {
    redirect("/login?from=/profile");
  }

  redirect(`/profile/${auth.user.username}`);
}
