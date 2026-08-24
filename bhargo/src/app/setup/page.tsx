import { redirect } from "next/navigation";

import { createFirstOwner } from "@/lib/actions";
import { Field } from "@/components/ui";
import { setupKeyRequired, userCount } from "@/lib/auth";
import { isDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";

/** First run only: creates the owner account, then disappears. */
export default function SetupPage({ searchParams }: { searchParams: { error?: string } }) {
  // The demo already has its owner; nobody should be claiming this one.
  if (userCount() > 0 || isDemo()) redirect("/login");
  const needsKey = setupKeyRequired();

  return (
    <div className="max-w-md mx-auto mt-10">
      <h1 className="text-2xl font-semibold">Set up Bhargo</h1>
      <p className="text-mute text-sm mt-2">
        This is the owner account — the only one that can add other people, change settings, and
        delete records. Keep the password to yourself.
      </p>

      <form action={createFirstOwner} className="card p-4 mt-6 space-y-4">
        {searchParams.error && (
          <p className="text-sm text-alert bg-alert/10 border border-alert/30 rounded px-3 py-2">
            {searchParams.error}
          </p>
        )}
        {needsKey && (
          <Field label="Setup key" hint="The key set on the server when Bhargo was installed.">
            <input name="setup_key" required className="input" autoComplete="off" />
          </Field>
        )}
        <Field label="Your name">
          <input name="name" required autoFocus className="input" placeholder="Pradil Jung" />
        </Field>
        <Field label="Username" hint="Letters, numbers, dot, dash or underscore.">
          <input name="username" required className="input" placeholder="pradil" />
        </Field>
        <Field label="Password" hint="At least 8 characters.">
          <input name="password" type="password" required minLength={8} className="input" />
        </Field>
        <button className="btn w-full">Create owner account</button>
      </form>
    </div>
  );
}
