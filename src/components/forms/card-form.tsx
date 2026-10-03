"use client";

import { useActionState } from "react";
import type { Card } from "@/db/schema";
import { CARD_BRANDS, CARD_COLORS, CARD_TYPES } from "@/lib/constants";
import { BANK_OPTIONS } from "@/lib/sms/banks";
import { CURRENCIES } from "@/lib/sms/currency";
import { createCardAction, updateCardAction, type ActionState } from "@/server/actions/cards";

const initial: ActionState = { ok: false };

export function CardForm({ card }: { card?: Card }) {
  const action = card ? updateCardAction : createCardAction;
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="surface space-y-4 p-4 sm:p-5">
      {card ? <input type="hidden" name="id" value={card.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="name">
            اسم البطاقة
          </label>
          <input id="name" name="name" defaultValue={card?.name} placeholder="فيزا CIB الأساسية" className="field" required />
          {state.errors?.name ? <p className="mt-1 text-[11px] text-rose-400">{state.errors.name}</p> : null}
        </div>

        <div>
          <label className="field-label" htmlFor="last4">
            آخر 4 أرقام <span className="text-brand-400">(مهمة لربط الرسائل)</span>
          </label>
          <input
            id="last4"
            name="last4"
            defaultValue={card?.last4}
            inputMode="numeric"
            maxLength={4}
            placeholder="4321"
            className="field font-mono tracking-widest"
            required
          />
          {state.errors?.last4 ? <p className="mt-1 text-[11px] text-rose-400">{state.errors.last4}</p> : null}
        </div>

        <div>
          <label className="field-label" htmlFor="bankKey">
            البنك
          </label>
          <select id="bankKey" name="bankKey" defaultValue={card?.bankKey ?? "cib"} className="field">
            {BANK_OPTIONS.map((bank) => (
              <option key={bank.value} value={bank.value}>
                {bank.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="brand">
            نوع الشبكة
          </label>
          <select id="brand" name="brand" defaultValue={card?.brand ?? "VISA"} className="field">
            {CARD_BRANDS.map((brand) => (
              <option key={brand.value} value={brand.value}>
                {brand.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="type">
            نوع البطاقة
          </label>
          <select id="type" name="type" defaultValue={card?.type ?? "CREDIT"} className="field">
            {CARD_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="currency">
            العملة
          </label>
          <select id="currency" name="currency" defaultValue={card?.currency ?? "EGP"} className="field">
            {CURRENCIES.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.ar} ({currency.code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="creditLimit">
            الحد الائتماني (للبطاقات الائتمانية)
          </label>
          <input
            id="creditLimit"
            name="creditLimit"
            defaultValue={card?.creditLimit ?? ""}
            inputMode="decimal"
            placeholder="50000"
            className="field"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="openingBalance">
            الرصيد / المستحق الافتتاحي
          </label>
          <input
            id="openingBalance"
            name="openingBalance"
            defaultValue={card?.openingBalance ?? 0}
            inputMode="decimal"
            className="field"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="statementDay">
            يوم كشف الحساب
          </label>
          <input id="statementDay" name="statementDay" defaultValue={card?.statementDay ?? ""} inputMode="numeric" placeholder="25" className="field" />
        </div>

        <div>
          <label className="field-label" htmlFor="dueDay">
            يوم السداد
          </label>
          <input id="dueDay" name="dueDay" defaultValue={card?.dueDay ?? ""} inputMode="numeric" placeholder="10" className="field" />
        </div>
      </div>

      <div>
        <span className="field-label">لون البطاقة</span>
        <div className="flex flex-wrap gap-2">
          {CARD_COLORS.map((color) => (
            <label key={color.value} className="cursor-pointer">
              <input
                type="radio"
                name="color"
                value={color.value}
                defaultChecked={(card?.color ?? "emerald") === color.value}
                className="peer sr-only"
              />
              <span
                className="block h-9 w-14 rounded-xl border-2 border-transparent transition peer-checked:border-white/90"
                style={{ background: `linear-gradient(135deg, ${color.from}, ${color.to})` }}
                title={color.label}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "جارٍ الحفظ…" : card ? "حفظ التعديلات" : "إضافة البطاقة"}
        </button>
        {state.message ? (
          <span className={`text-xs font-semibold ${state.ok ? "text-emerald-300" : "text-rose-300"}`}>{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}
