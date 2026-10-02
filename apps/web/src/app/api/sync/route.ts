import { auth } from "@/auth";
import { isOwnerEmail } from "@/lib/authz";
import { env } from "@/lib/env";

const MAX_SYNC_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await auth();
  if (!isOwnerEmail(session?.user?.email, env.AUTH_OWNER_EMAILS)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json(
      { error: "content type must be JSON" },
      { status: 415 },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_SYNC_BYTES) {
    return Response.json({ error: "request too large" }, { status: 413 });
  }

  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_SYNC_BYTES) {
    return Response.json({ error: "request too large" }, { status: 413 });
  }

  const upstreamUrl = `http://${env.SYNC_SERVER_HOST}:${env.SYNC_SERVER_PORT}/sync`;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.INTERNAL_SYNC_SECRET}`,
        "content-type": "application/json",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { error: "sync temporarily unavailable" },
      { status: 503 },
    );
  }
}
