import { redirect } from "next/navigation";

import { signInAction } from "@/lib/actions";
import { Field } from "@/components/ui";
import { currentUser, userCount } from "@/lib/auth";
import { DEMO_PASSWORD, DEMO_USERNAME, isDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";

export default function LoginPage({ searchParams }: { searchParams: { error?: string; next?: string } }) {
  if (userCount() === 0) redirect("/setup");
  if (currentUser()) redirect(searchParams.next || "/");

  return (
    <div className="max-w-sm mx-auto mt-16">
      <h1 className="text-2xl font-semibold">Bhargo</h1>
      <p className="text-mute text-sm mt-1">Sign in to reach the books.</p>

      <form action={signInAction} className="card p-4 mt-6 space-y-4">
        <input type="hidden" name="next" value={searchParams.next ?? ""} />
        {searchParams.error && (
          <p className="text-sm text-alert bg-alert/10 border border-alert/30 rounded px-3 py-2">
            {searchParams.error}
          </p>
        )}
        <Field label="Username">
          <input
            name="username"
            required
            autoFocus
            autoCapitalize="none"
            defaultValue={isDemo() ? DEMO_USERNAME : undefined}
            className="input"
          />
        </Field>
        <Field label="Password">
          <input
            name="password"
            type="password"
            required
            defaultValue={isDemo() ? DEMO_PASSWORD : undefined}
            className="input"
          />
        </Field>
        <button className="btn w-full">Sign in</button>
      </form>

      {isDemo() ? (
        <p className="text-xs text-mute mt-4">
          Filled in for you: <span className="font-mono">{DEMO_USERNAME}</span> /{" "}
          <span className="font-mono">{DEMO_PASSWORD}</span>. Press Sign in and look around — the
          books belong to an invented contractor, and nothing here lasts.
        </p>
      ) : (
        <p className="text-xs text-mute mt-4">
          No account? Only the owner can create one. Ask them to add you.
        </p>
      )}
    </div>
  );
}
