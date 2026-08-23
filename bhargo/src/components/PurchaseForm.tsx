"use client";

import { useMemo, useState } from "react";

import { addPurchase } from "@/lib/actions";
import { MATERIALS, material } from "@/lib/materials";
import { formatMoney } from "@/lib/money";
import { checkAgainstUsual } from "@/lib/pricecheck";
import type { PriceEntry, Project, Settings } from "@/lib/types";

/**
 * The bill is judged while it is being typed, not after it is saved. Someone
 * standing at the gate with a delivery can see "21% over the usual price"
 * before they sign for it, which is the only moment the answer is much use.
 */
export default function PurchaseForm({
  projects,
  defaultProjectId,
  vendors,
  priceBook,
  settings,
  needsApproval,
}: {
  projects: Project[];
  defaultProjectId: number;
  vendors: string[];
  priceBook: PriceEntry[];
  settings: Settings;
  needsApproval: boolean;
}) {
  const [materialKey, setMaterialKey] = useState("cement");
  const [unit, setUnit] = useState(material("cement").unit);
  const [qty, setQty] = useState("");
  const [rate, setRate] = useState("");
  const [freight, setFreight] = useState("");

  const book = useMemo(() => new Map(priceBook.map((entry) => [entry.material_key, entry])), [priceBook]);

  const qtyNum = Number(qty) || 0;
  const rateNum = Number(rate) || 0;
  const freightNum = Number(freight) || 0;
  const landedRate = qtyNum > 0 ? (qtyNum * rateNum + freightNum) / qtyNum : rateNum;
  const amount = qtyNum * rateNum + freightNum;

  const check = checkAgainstUsual(materialKey, landedRate, qtyNum, book.get(materialKey), settings, settings.currency);
  const show = rateNum > 0;

  const tone =
    check.verdict === "far-over"
      ? "bg-alert/10 border-alert/30 text-alert"
      : check.verdict === "over"
      ? "bg-warn/10 border-warn/30 text-warn"
      : check.verdict === "under"
      ? "bg-ok/10 border-ok/30 text-ok"
      : check.verdict === "fair"
      ? "bg-ok/10 border-ok/30 text-ok"
      : "bg-paper border-line text-mute";

  return (
    <form action={addPurchase} className="p-3 sm:p-4 space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="block col-span-2 lg:col-span-1">
          <span className="label">Build</span>
          <select name="project_id" defaultValue={defaultProjectId} className="input">
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block col-span-2 lg:col-span-1">
          <span className="label">Material</span>
          <select
            name="material_key"
            value={materialKey}
            onChange={(e) => {
              setMaterialKey(e.target.value);
              setUnit(book.get(e.target.value)?.unit ?? material(e.target.value).unit);
            }}
            className="input"
          >
            {MATERIALS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Unit</span>
          <input name="unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="input" />
        </label>

        <label className="block">
          <span className="label">Quantity</span>
          <input
            name="qty"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            required
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="input"
          />
        </label>

        <label className="block">
          <span className="label">Rate per {unit}</span>
          <input
            name="rate"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            required
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="input"
          />
        </label>

        <label className="block">
          <span className="label">Freight</span>
          <input
            name="freight"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={freight}
            onChange={(e) => setFreight(e.target.value)}
            className="input"
          />
        </label>

      </div>

      {show && (
        <div className={`rounded border px-3 py-2 text-sm ${tone}`} role="status" aria-live="polite">
          <div className="font-medium">
            {check.verdict === "no-benchmark"
              ? "No usual price set for this material"
              : check.verdict === "far-over" || check.verdict === "over"
              ? `${check.diffPct.toFixed(0)}% over your usual price`
              : check.verdict === "under"
              ? `${Math.abs(check.diffPct).toFixed(0)}% under your usual price`
              : "In line with your usual price"}
          </div>
          <div className="mt-0.5">{check.message}</div>
          {amount > 0 && (
            <div className="mt-1 text-ink/80">
              This bill comes to <strong>{formatMoney(Math.round(amount), settings.currency)}</strong>
              {freightNum > 0 && (
                <> — {formatMoney(Math.round(landedRate), settings.currency)} per {unit} delivered</>
              )}
              .
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="block">
          <span className="label">Vendor</span>
          <input name="vendor" list="vendors" className="input" />
          <datalist id="vendors">
            {vendors.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </label>

        <label className="block">
          <span className="label">Bill number</span>
          <input name="invoice_no" className="input" />
        </label>

        <label className="block">
          <span className="label">Date</span>
          <input name="purchased_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
        </label>

        <label className="block col-span-2 lg:col-span-2">
          <span className="label">Note</span>
          <input name="note" className="input" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn">Save bill</button>
        <span className="text-xs text-mute">
          {needsApproval
            ? "Saved bills wait for the owner to confirm them before they count."
            : "Your own entries are confirmed as you save them."}
        </span>
      </div>
    </form>
  );
}
