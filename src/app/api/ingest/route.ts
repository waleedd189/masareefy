import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { apiTokens } from "@/db/schema";
import { runMigrations } from "@/db/migrate";
import { ingestMessage } from "@/lib/services/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const singleSchema = z.object({
  text: z.string().min(3).optional(),
  message: z.string().min(3).optional(),
  body: z.string().min(3).optional(),
  sender: z.string().optional().nullable(),
  from: z.string().optional().nullable(),
  receivedAt: z.union([z.string(), z.number()]).optional().nullable(),
  cardId: z.string().optional().nullable(),
});

const payloadSchema = z.union([singleSchema, z.object({ messages: z.array(singleSchema) })]);

async function authorize(request: NextRequest): Promise<boolean> {
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
  const token = bearer ?? request.nextUrl.searchParams.get("token") ?? request.headers.get("x-api-key");
  if (!token) return false;

  if (process.env.INGEST_TOKEN && token === process.env.INGEST_TOKEN) return true;

  const [row] = await db.select().from(apiTokens).where(eq(apiTokens.token, token)).limit(1);
  if (!row) return false;
  await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.id));
  return true;
}

function toDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * استقبال رسائل البنك تلقائياً من تطبيق موبايل (SMS Forwarder / Tasker / MacroDroid)
 *
 * POST /api/ingest
 * Authorization: Bearer <token>
 * { "text": "نص الرسالة", "sender": "CIB", "receivedAt": "2026-10-03T12:00:00Z" }
 */
export async function POST(request: NextRequest) {
  await runMigrations();

  if (!(await authorize(request))) {
    return NextResponse.json({ ok: false, error: "مفتاح API غير صالح" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON غير صالح" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "صيغة البيانات غير صحيحة", issues: parsed.error.issues }, { status: 400 });
  }

  const items = "messages" in parsed.data ? parsed.data.messages : [parsed.data];
  const results = [];

  for (const item of items) {
    const text = item.text ?? item.message ?? item.body ?? "";
    if (!text.trim()) continue;
    const result = await ingestMessage({
      rawText: text,
      sender: item.sender ?? item.from ?? null,
      receivedAt: toDate(item.receivedAt),
      cardId: item.cardId ?? null,
      source: "WEBHOOK",
    });
    results.push({
      status: result.status,
      messageId: result.messageId,
      transactionId: result.transactionId,
      cardId: result.cardId,
      amount: result.parsed?.amount ?? null,
      last4: result.parsed?.last4 ?? null,
      reason: result.reason,
    });
  }

  return NextResponse.json({ ok: true, count: results.length, results });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    usage: "POST /api/ingest مع Authorization: Bearer <token> و body يحتوي على text و sender",
  });
}
