import { removePrice, savePrice } from "@/lib/actions";
import { Card, Pill } from "@/components/ui";
import { isOwner, requireUser } from "@/lib/auth";
import { getSettings, listPriceBook, recentRateFor } from "@/lib/db";
import { MATERIALS } from "@/lib/materials";
import { formatMoney, formatRate } from "@/lib/money";

export const dynamic = "force-dynamic";

export default function PricesPage() {
  const user = requireUser();
  const owner = isOwner(user);
  const settings = getSettings();
  const book = new Map(listPriceBook().map((entry) => [entry.material_key, entry]));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl sm:text-2xl font-semibold">What things usually cost</h1>
        <p className="text-mute text-sm mt-1 max-w-2xl">
          Write down what you expect to pay for each material. Every bill is then checked against it
          the moment someone enters it — no second build needed, and no waiting until the house is
          finished to find out.
          {!owner && " Only the owner can change these figures."}
        </p>
      </header>

      <Card title="Your prices" subtitle={`Anything ${settings.watch_pct}% above gets a question mark, ${settings.alert_pct}% above gets a warning.`}>
        <div className="divide-y divide-line">
          {MATERIALS.map((m) => {
            const entry = book.get(m.key);
            const recent = recentRateFor(m.key);

            return (
              <form
                key={m.key}
                action={savePrice}
                className="p-3 sm:p-4 flex flex-wrap items-end gap-3"
              >
                <input type="hidden" name="material_key" value={m.key} />
                <input type="hidden" name="unit" value={entry?.unit ?? m.unit} />

                <div className="min-w-[10rem] flex-1">
                  <div className="font-medium">{m.label}</div>
                  <div className="text-xs text-mute">
                    per {entry?.unit ?? m.unit}
                    {entry ? ` · set ${entry.updated_at.slice(0, 10)}` : ""}
                  </div>
                </div>

                <label className="w-32">
                  <span className="label">Usual rate</span>
                  <input
                    name="usual_rate"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    defaultValue={entry?.usual_rate ?? ""}
                    placeholder={recent ? String(Math.round(recent.avgRate)) : "—"}
                    disabled={!owner}
                    className="input disabled:bg-paper disabled:text-mute"
                  />
                </label>

                <label className="flex-1 min-w-[12rem]">
                  <span className="label">Where the figure comes from</span>
                  <input
                    name="note"
                    defaultValue={entry?.note ?? ""}
                    placeholder="Quotation, last load, market"
                    disabled={!owner}
                    className="input disabled:bg-paper disabled:text-mute"
                  />
                </label>

                {owner && (
                  <div className="flex gap-2">
                    <button className="btn">Save</button>
                    {entry && (
                      <button formAction={removePrice} className="btn-quiet">
                        Clear
                      </button>
                    )}
                  </div>
                )}

                <div className="w-full text-xs text-mute">
                  {recent ? (
                    <>
                      Your last {recent.lines} confirmed bill{recent.lines === 1 ? "" : "s"} averaged{" "}
                      <strong>{formatRate(recent.avgRate)}</strong> per {entry?.unit ?? m.unit}
                      {entry && entry.usual_rate > 0 && (
                        <>
                          {" "}
                          — that is{" "}
                          {formatMoney(Math.round(recent.avgRate - entry.usual_rate), settings.currency)}{" "}
                          {recent.avgRate >= entry.usual_rate ? "above" : "below"} the figure you set.
                        </>
                      )}
                    </>
                  ) : (
                    <>Nothing bought yet, so there is no history to compare with.</>
                  )}
                </div>
              </form>
            );
          })}
        </div>
      </Card>

      <Card title="How this is used">
        <div className="p-4 text-sm text-mute space-y-2">
          <p>
            When a bill is entered, its rate is compared with the figure here straight away and the
            person entering it sees the answer before saving. The same check appears on the bill
            list and on anything waiting for your confirmation.
          </p>
          <p>
            <Pill kind="alert">Far over</Pill> and <Pill kind="watch">Over</Pill> are the ones to
            chase. <Pill kind="ok">Under</Pill> is flagged too — a rate well below the going price
            often means a different grade or a short load, and it is better to ask on the day than
            after the wall is up.
          </p>
        </div>
      </Card>
    </div>
  );
}
