// @ts-nocheck — Supabase query types will be auto-generated
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  try {
    const { analysisId } = await params;
    const supabase = await createClient();

    // Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success: rateLimitOk, resetIn } = rateLimit(`audio:${user.id}`, 30, 60_000);
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(resetIn / 1000)) } }
      );
    }

    // Fetch analysis with ownership check
    const { data: analysis } = await supabase
      .from("analyses")
      .select("audio_url, user_id, file_name")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .single();

    if (!analysis) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    }

    // Generate signed URL from the storage path
    // The audio_url might be a public URL — extract the path from it
    const adminClient = createAdminClient();

    // Try to extract the storage path from the URL
    const storagePrefixes = [
      "/storage/v1/object/public/probatio-audio/",
      "/storage/v1/object/public/spectra-audio/",
    ];
    let storagePath = "";
    let bucketName = "probatio-audio";

    const matchedPrefix = storagePrefixes.find((p) => analysis.audio_url?.includes(p));
    if (matchedPrefix) {
      storagePath = analysis.audio_url!.split(matchedPrefix).pop() ?? "";
      bucketName = matchedPrefix.split("/public/")[1]?.replace("/", "") || "probatio-audio";
    } else {
      storagePath = `${user.id}/${analysisId}/original/${analysis.file_name}`;
    }

    const { data: signedUrlData, error: urlError } = await adminClient.storage
      .from(bucketName)
      .createSignedUrl(storagePath, 3600); // 1 hour

    if (urlError || !signedUrlData?.signedUrl) {
      return NextResponse.json(
        { error: "Failed to generate audio URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: signedUrlData.signedUrl,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      fileName: analysis.file_name,
    });
  } catch (error) {
    console.error("Audio URL error:", error);
    return NextResponse.json(
      { error: "Failed to generate audio URL" },
      { status: 500 }
    );
  }
}
