import { Suspense } from "react";
import { CardTile } from "@/components/card-tile";
import { CollapsiblePanel } from "@/components/collapsible-panel";
import { CardForm } from "@/components/forms/card-form";
import { TransferForm } from "@/components/forms/transfer-form";
import { Badge, EmptyState, PageHeader, SectionCard } from "@/components/ui";
import { CARD_TYPE_LABELS } from "@/lib/constants";
import { formatDateTime, formatMoney, maskedCard } from "@/lib/format";
import { listCards, listTransactions } from "@/lib/services/queries";
import { isSpend, monthRange } from "@/lib/services/stats";
import { toggleArchiveCardAction } from "@/server/actions/cards";
import { deleteTransferAction } from "@/server/actions/transfers";
import { listTransfers } from "@/lib/services/transfers";

export const dynamic = "force-dynamic";

export default async function CardsPage() {
  const { start } = monthRange();
  const [cards, archived, monthTx, transfers] = await Promise.all([
    listCards(),
    listCards(true),
    listTransactions({ from: start, limit: 500 }),
    listTransfers(8),
  ]);

  const archivedOnly = archived.filter((card) => card.isArchived);
  const spentByCard = new Map<string, number>();
  for (const tx of monthTx) {
    if (!tx.cardId || !isSpend(tx)) continue;
    spentByCard.set(tx.cardId, (spentByCard.get(tx.cardId) ?? 0) + tx.amount);
  }

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        title="البطاقات"
        subtitle="كل بطاقة بآخر 4 أرقام — الرسائل بتتربط بيها تلقائياً"
      />

      <Suspense fallback={null}>
        <CollapsiblePanel label="إضافة بطاقة جديدة" openLabel="＋ إضافة بطاقة جديدة" defaultOpenParam="new">
          <CardForm />
        </CollapsiblePanel>
      </Suspense>

      {cards.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <CardTile key={card.id} card={card} spentThisMonth={spentByCard.get(card.id) ?? 0} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="💳"
          title="مفيش بطاقات"
          description="ابدأ بإضافة بطاقة — محتاج اسمها، البنك، وآخر 4 أرقام بس."
        />
      )}

      {cards.length >= 2 ? (
        <SectionCard
          title="⇄ تحويل بين الحسابات"
          subtitle="من الحساب الجاري للفيزا، أو من المحفظة للكاش — بيتسجل على الطرفين برصيد محدّث"
        >
          <TransferForm
            cards={cards.map((card) => ({
              id: card.id,
              name: card.name,
              last4: card.last4,
              currency: card.currency,
              type: card.type,
              balance: card.currentBalance,
            }))}
          />
        </SectionCard>
      ) : null}

      {transfers.length ? (
        <SectionCard title="آخر التحويلات" subtitle="كل تحويل = عمليتين (خارج وداخل) مربوطتين ببعض">
          <ul className="space-y-2">
            {transfers.map((tx) => (
                <li key={tx.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-ink-700/60 bg-ink-950/50 px-3 py-2">
                  <div className="min-w-0 text-xs">
                    <p className="truncate font-bold text-ink-100">
                      {tx.fromName} ← {tx.toName}
                    </p>
                    <p className="truncate text-[11px] text-ink-500">
                      {formatDateTime(tx.occurredAt)}
                      {tx.description ? ` · ${tx.description}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="border-brand-500/30 bg-brand-500/10 text-brand-300">
                      <span data-money>{formatMoney(tx.amount, tx.currency)}</span>
                    </Badge>
                    <form action={deleteTransferAction}>
                      <input type="hidden" name="transferId" value={tx.transferId} />
                      <button type="submit" className="text-[11px] font-semibold text-rose-300">
                        إلغاء التحويل
                      </button>
                    </form>
                  </div>
                </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {cards.length ? (
        <SectionCard title="ملخص سريع">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-right text-sm">
              <thead className="text-[11px] uppercase text-ink-400">
                <tr className="border-b border-ink-700/60">
                  <th className="pb-2 font-semibold">البطاقة</th>
                  <th className="pb-2 font-semibold">النوع</th>
                  <th className="pb-2 font-semibold">المستحق / الرصيد</th>
                  <th className="pb-2 font-semibold">المتاح</th>
                  <th className="pb-2 font-semibold">مصروف الشهر</th>
                  <th className="pb-2 font-semibold">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700/40">
                {cards.map((card) => (
                  <tr key={card.id}>
                    <td className="py-2.5">
                      <span className="font-bold">{card.name}</span>
                      <span className="block font-mono text-[11px] text-ink-400">{maskedCard(card.last4)}</span>
                    </td>
                    <td className="py-2.5 text-xs text-ink-300">{CARD_TYPE_LABELS[card.type]}</td>
                    <td className="py-2.5 tabular-nums">{formatMoney(card.currentBalance, card.currency)}</td>
                    <td className="py-2.5 tabular-nums text-ink-300">
                      {card.availableAmount !== null ? formatMoney(card.availableAmount, card.currency) : "—"}
                    </td>
                    <td className="py-2.5 tabular-nums text-ink-300">
                      {formatMoney(spentByCard.get(card.id) ?? 0, card.currency)}
                    </td>
                    <td className="py-2.5">
                      <form action={toggleArchiveCardAction}>
                        <input type="hidden" name="id" value={card.id} />
                        <button type="submit" className="text-xs font-semibold text-ink-400 hover:text-rose-300">
                          أرشفة
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}

      {archivedOnly.length ? (
        <SectionCard title="بطاقات مؤرشفة">
          <ul className="space-y-2">
            {archivedOnly.map((card) => (
              <li key={card.id} className="flex items-center justify-between gap-3 rounded-xl bg-ink-950/50 px-3 py-2 text-sm">
                <span>
                  {card.name} <span className="font-mono text-[11px] text-ink-400">{maskedCard(card.last4)}</span>
                </span>
                <form action={toggleArchiveCardAction}>
                  <input type="hidden" name="id" value={card.id} />
                  <button type="submit" className="text-xs font-semibold text-brand-300">
                    إرجاع
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
    </div>
  );
}
