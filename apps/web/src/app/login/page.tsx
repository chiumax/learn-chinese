import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { isOwnerEmail } from "@/lib/authz";
import { env } from "@/lib/env";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  if (isOwnerEmail(session?.user?.email, env.AUTH_OWNER_EMAILS)) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12 text-center">
      <div>
        <h1 className="text-3xl font-bold">学中文</h1>
        <p className="text-muted-foreground mt-2">
          Sign in with the private owner account to continue.
        </p>
      </div>
      {params.error ? (
        <p className="text-sm text-red-600">
          That Google account is not allowed to use this app.
        </p>
      ) : null}
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <Button className="w-full" type="submit">
          Continue with Google
        </Button>
      </form>
    </main>
  );
}
