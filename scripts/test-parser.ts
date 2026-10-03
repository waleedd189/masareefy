import { parseSms } from "../src/lib/sms/parse";
import { SAMPLE_MESSAGES } from "../src/lib/sms/samples";

for (const sample of SAMPLE_MESSAGES) {
  const parsed = parseSms(sample.text, { sender: sample.sender, receivedAt: new Date() });
  console.log("—".repeat(60));
  console.log("sender:", sample.sender, "|", sample.text.slice(0, 70));
  console.log({
    bank: parsed.bankKey,
    type: parsed.type,
    dir: parsed.direction,
    amount: parsed.amount,
    cur: parsed.currency,
    fx: parsed.fxAmount ? `${parsed.fxAmount} ${parsed.fxCurrency}` : null,
    last4: parsed.last4,
    merchant: parsed.merchant,
    balance: parsed.availableBalance,
    date: parsed.occurredAt?.toISOString().slice(0, 16),
    conf: parsed.confidence,
    financial: parsed.isFinancial,
  });
}
