import assert from "node:assert/strict";
import { parseSpokenArabicNumber, parseVoiceExpense, type VoiceCard } from "../src/lib/voice-expense";

const cards: VoiceCard[] = [
  { id: "cib", name: "فيزا CIB الأساسية", last4: "4321", bankKey: "cib" },
  { id: "nbe", name: "ماستر الأهلي", last4: "7788", bankKey: "nbe" },
];

assert.equal(parseSpokenArabicNumber("ميتين وخمسين"), 250);
assert.equal(parseSpokenArabicNumber("الف وتلتميه وخمسين"), 1350);
assert.equal(parseSpokenArabicNumber("اتنين الاف وميتين"), 2200);

const purchase = parseVoiceExpense("دفعت ٢٥٠ جنيه في كارفور على فيزا CIB الأساسية", cards);
assert.equal(purchase.amount, 250);
assert.equal(purchase.merchant, "كارفور");
assert.equal(purchase.cardId, "cib");
assert.equal(purchase.type, "PURCHASE");

const spoken = parseVoiceExpense("سجل ميتين وخمسين جنيه في طلبات على كارت 4321", cards);
assert.equal(spoken.amount, 250);
assert.equal(spoken.merchant, "طلبات");
assert.equal(spoken.cardId, "cib");

const withdrawal = parseVoiceExpense("سحبت 1000 جنيه من ماكينة على ماستر الأهلي", cards);
assert.equal(withdrawal.amount, 1000);
assert.equal(withdrawal.cardId, "nbe");
assert.equal(withdrawal.type, "WITHDRAWAL");

console.log("✅ نجحت اختبارات إدخال المصروفات بالصوت");
