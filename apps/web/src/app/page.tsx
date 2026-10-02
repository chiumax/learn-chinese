import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { StudyView } from "@/components/study/study-view";
import { Button } from "@/components/ui/button";
import { isOwnerEmail } from "@/lib/authz";
import { env } from "@/lib/env";

export default async function Home() {
  const session = await auth();
  if (!isOwnerEmail(session?.user?.email, env.AUTH_OWNER_EMAILS)) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8 px-4 py-12">
      <header className="text-center">
        <h1 className="text-3xl font-bold">学中文</h1>
        <p className="text-muted-foreground mt-1">
          Offline-first spaced repetition · powered by FSRS
        </p>
        <form
          className="mt-3"
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </header>
      <StudyView />
    </main>
  );
}
