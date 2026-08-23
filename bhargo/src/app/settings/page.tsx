import { saveSettingsAction } from "@/lib/actions";
import { requireOwner } from "@/lib/auth";
import { Card, Field } from "@/components/ui";
import { getSettings } from "@/lib/db";
import { MATERIALS } from "@/lib/materials";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  requireOwner();
  const settings = getSettings();

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-mute text-sm mt-1">
          These decide what counts as a normal price rise and what counts as being charged too much.
        </p>
      </header>

      <Card title="Thresholds">
        <form action={saveSettingsAction} className="p-4 grid sm:grid-cols-2 gap-4">
          <Field label="Currency symbol">
            <input name="currency" defaultValue={settings.currency} className="input" />
          </Field>
          <Field
            label="Normal price rise (% a year)"
            hint="Used when a material has no drift of its own. Cement, sand and steel each use their own."
          >
            <input name="inflation_pct" type="number" step="0.5" defaultValue={settings.inflation_pct} className="input" />
          </Field>
          <Field label="Worth asking above (%)" hint="How far above the fair price before a rate gets a second look.">
            <input name="watch_pct" type="number" step="1" defaultValue={settings.watch_pct} className="input" />
          </Field>
          <Field label="Overcharged above (%)" hint="Where a rate stops being explainable.">
            <input name="alert_pct" type="number" step="1" defaultValue={settings.alert_pct} className="input" />
          </Field>
          <Field
            label="Quantity overrun above (%)"
            hint="How much more material per sq.ft than the last build before it gets flagged."
          >
            <input name="qty_watch_pct" type="number" step="1" defaultValue={settings.qty_watch_pct} className="input" />
          </Field>
          <Field label="Working days in a month" hint="Divides a monthly salary into a day rate. 26 is the usual figure.">
            <input
              name="working_days_per_month"
              type="number"
              step="1"
              defaultValue={settings.working_days_per_month}
              className="input"
            />
          </Field>
          <div className="sm:col-span-2">
            <button className="btn">Save settings</button>
          </div>
        </form>
      </Card>

      <Card
        title="How fast each material normally moves"
        subtitle="Built in. Edit src/lib/materials.ts if your market behaves differently."
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="th">Material</th>
                <th className="th">Unit</th>
                <th className="th num">Normal rise per year</th>
              </tr>
            </thead>
            <tbody>
              {MATERIALS.map((m) => (
                <tr key={m.key}>
                  <td className="td">{m.label}</td>
                  <td className="td text-mute">{m.unit}</td>
                  <td className="td num">{m.driftPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
