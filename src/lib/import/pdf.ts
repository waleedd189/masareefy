import { inflateSync, inflateRawSync } from "node:zlib";

/**
 * قارئ نصوص PDF بدون أي اعتمادية خارجية — لاستيراد كشوف الحساب.
 *
 * الفكرة: PDF = كائنات فيها streams (غالبًا مضغوطة بـFlateDecode).
 * بنفك الضغط بـzlib وبنقرأ مشغّلات عرض النص من content stream:
 * `(نص) Tj` · `[(أ) -250 (ب)] TJ` · `'` · `"` مع تتبع أوامر نقل السطر (Td/TD/Tm) كفواصل.
 *
 * حدود الأمانة التقنية:
 * - الكشوف اللي بتستخدم خطوط مضمّنة بترميز CID (خصوصًا العربي) ممكن تطلع رموز مش مفهومة،
 *   والكشوف المصوّرة (اسكانر) محتاجة OCR — وده بند متأجل.
 * - فالنتيجة بتترجع مع `warnings` عشان المستخدم يعرف لو الاستخراج ناقص.
 */

export interface PdfText {
  lines: string[];
  text: string;
  pages: number;
  warnings: string[];
}

const STREAM_START = Buffer.from("stream");
const STREAM_END = Buffer.from("endstream");

function findStreams(buf: Buffer): { data: Buffer; dict: string }[] {
  const out: { data: Buffer; dict: string }[] = [];
  let cursor = 0;

  while (cursor < buf.length) {
    const start = buf.indexOf(STREAM_START, cursor);
    if (start === -1) break;
    // أول سطر بعد "stream" (ممكن يكون \r\n أو \n)
    let dataStart = start + STREAM_START.length;
    if (buf[dataStart] === 0x0d) dataStart++;
    if (buf[dataStart] === 0x0a) dataStart++;

    const end = buf.indexOf(STREAM_END, dataStart);
    if (end === -1) break;

    let dataEnd = end;
    if (buf[dataEnd - 1] === 0x0a) dataEnd--;
    if (buf[dataEnd - 1] === 0x0d) dataEnd--;

    // قاموس الكائن: آخر 600 بايت قبل "stream"
    const dictStart = Math.max(0, start - 600);
    const dict = buf.subarray(dictStart, start).toString("latin1");
    out.push({ data: buf.subarray(dataStart, dataEnd), dict });
    cursor = end + STREAM_END.length;
  }

  return out;
}

function tryInflate(data: Buffer): Buffer | null {
  try {
    return inflateSync(data);
  } catch {
    // بعض الملفات بتكتب raw deflate من غير zlib header
    try {
      return inflateRawSync(data);
    } catch {
      return null;
    }
  }
}

/** فك ترميز سلسلة بايتات من PDF (UTF-16BE لو فيه BOM، وإلا latin1/WinAnsi) */
function decodeStringBytes(bytes: number[]): string {
  const buf = Buffer.from(bytes);
  // UTF-16BE لو فيه BOM
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    let out = "";
    for (let i = 2; i + 1 < buf.length; i += 2) out += String.fromCharCode(buf.readUInt16BE(i));
    return out;
  }
  return buf.toString("latin1");
}

/** تحليل سلسلة بين قوسين مع التعامل مع الـescapes */
function parseLiteralString(content: string, startIndex: number): { value: string; next: number } {
  const bytes: number[] = [];
  let i = startIndex + 1;
  let depth = 1;

  while (i < content.length) {
    const ch = content[i];
    if (ch === "\\") {
      const esc = content[i + 1];
      if (esc === "n") bytes.push(10);
      else if (esc === "r") bytes.push(13);
      else if (esc === "t") bytes.push(9);
      else if (esc === "b") bytes.push(8);
      else if (esc === "f") bytes.push(12);
      else if (esc >= "0" && esc <= "7") {
        let octal = "";
        let j = i + 1;
        while (j < content.length && octal.length < 3 && content[j] >= "0" && content[j] <= "7") {
          octal += content[j];
          j++;
        }
        bytes.push(parseInt(octal, 8) & 0xff);
        i = j;
        continue;
      } else if (esc === "\n") {
        // سطر مكمل — بيتجاهل
      } else bytes.push(esc.charCodeAt(0) & 0xff);
      i += 2;
      continue;
    }
    if (ch === "(") depth++;
    if (ch === ")") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
    bytes.push(ch.charCodeAt(0) & 0xff);
    i++;
  }

  return { value: decodeStringBytes(bytes), next: i };
}

/** سلسلة hex مثل <48656C6C6F> */
function parseHexString(content: string, startIndex: number): { value: string; next: number } {
  const end = content.indexOf(">", startIndex);
  if (end === -1) return { value: "", next: content.length };
  const hex = content.slice(startIndex + 1, end).replace(/[^0-9a-fA-F]/g, "");
  const bytes: number[] = [];
  for (let i = 0; i + 1 < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16));
  if (hex.length % 2 === 1) bytes.push(parseInt(hex.slice(-1), 16) << 4);
  return { value: decodeStringBytes(bytes), next: end + 1 };
}

/**
 * استخراج النص من content stream: بنمشي على المشغّلات وبنجمّع القطع،
 * وأي أمر نقل سطر (Td أو TD أو Tm أو T-star أو ET) بيفتح سطر جديد.
 */
function extractTextFromContent(content: string): string[] {
  const lines: string[] = [];
  let current = "";
  let i = 0;

  const flushLine = () => {
    const trimmed = current.replace(/\s+/g, " ").trim();
    if (trimmed) lines.push(trimmed);
    current = "";
  };

  while (i < content.length) {
    const ch = content[i];

    if (ch === "(") {
      const parsed = parseLiteralString(content, i);
      current += parsed.value;
      i = parsed.next;
      continue;
    }
    if (ch === "<" && content[i + 1] !== "<") {
      const parsed = parseHexString(content, i);
      current += parsed.value;
      i = parsed.next;
      continue;
    }

    // مشغّلات: بنقرأ الكلمة الحالية
    if (/[A-Za-z'"*]/.test(ch)) {
      let j = i;
      while (j < content.length && /[A-Za-z0-9'"*.\-]/.test(content[j])) j++;
      const op = content.slice(i, j);
      i = j;

      // Tj/TJ: النص اتجمع قبل المشغّل — مفيش إجراء هنا
      if (op === "Td" || op === "TD" || op === "Tm" || op === "T*" || op === "ET" || op === "'" || op === '"') {
        flushLine();
      }
      continue;
    }

    i++;
  }
  flushLine();
  return lines;
}

/** استخراج نص ملف PDF كامل */
export function extractPdfText(buffer: Buffer): PdfText {
  const warnings: string[] = [];
  const header = buffer.subarray(0, 1024).toString("latin1");
  if (!header.includes("%PDF-")) warnings.push("الملف مش PDF صالح (مفيش ترويسة %PDF)");

  const streams = findStreams(buffer);
  if (!streams.length) warnings.push("مفيش streams في الملف — ممكن يكون مشفّر أو تالف");

  const lines: string[] = [];
  let pages = 0;
  let contentStreams = 0;

  for (const stream of streams) {
    const isFlate = /\/FlateDecode/.test(stream.dict);
    if (/\/Type\s*\/Page[^s]/.test(stream.dict)) pages++;

    let data: Buffer | null = null;
    if (isFlate) {
      data = tryInflate(stream.data);
      if (!data) warnings.push("stream مضغوط مفكّش — اتخطّى");
    } else {
      data = stream.data;
    }
    if (!data) continue;

    const text = data.toString("latin1");
    // content stream فيه مشغّلات رسم/نص
    if (!/\b(BT|Tj|TJ|Td|Tm)\b/.test(text)) continue;
    contentStreams++;
    lines.push(...extractTextFromContent(text));
  }

  if (!contentStreams) warnings.push("مفيش content streams مفهومة — الكشاف ممكن يكون صورة (محتاج OCR)");

  const clean = lines
    .map((line) => line.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ").trim())
    .filter((line) => line.length > 0);

  // لو أغلب السطور رموز غريبة ⇒ الترميز CID (بنبلّغ المستخدم)
  const readable = clean.filter((line) => /[\p{L}\p{N}]{2,}/u.test(line));
  if (clean.length && readable.length / clean.length < 0.5) {
    warnings.push("النص المستخرج مش مقروء (خطوط بترميز CID) — جرّب تصدير الكشف CSV من البنك");
  }

  return { lines: clean, text: clean.join("\n"), pages, warnings: [...new Set(warnings)] };
}
