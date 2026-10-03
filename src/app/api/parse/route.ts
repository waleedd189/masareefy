import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { parseSms } from "@/lib/sms/parse";

export const runtime = "nodejs";

const schema = z.object({
  text: z.string().min(3, "النص قصير"),
  sender: z.string().optional().nullable(),
});

/** تحليل رسالة بدون حفظ – مفيد لاختبار القوالب */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "ابعت { text, sender }" }, { status: 400 });
  }
  const result = parseSms(parsed.data.text, { sender: parsed.data.sender ?? null, receivedAt: new Date() });
  return NextResponse.json({ ok: true, result });
}
