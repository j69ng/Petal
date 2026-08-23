import { changePassword, createStaffUser, removeUser, toggleUser } from "@/lib/actions";
import { Card, Field, Pill } from "@/components/ui";
import { listUsers, requireOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function UsersPage({ searchParams }: { searchParams: { error?: string; ok?: string } }) {
  const owner = requireOwner();
  const users = listUsers();

  return (
    <div className="space-y-6 max-w-4xl">
      <header>
        <h1 className="text-2xl font-semibold">Who can get in</h1>
        <p className="text-mute text-sm mt-1 max-w-2xl">
          Only the people listed here can open Bhargo. There is no sign-up — accounts are made by
          you. When someone leaves, switch them off: their account stops working immediately and
          everything they recorded stays put.
        </p>
      </header>

      {searchParams.error && (
        <p className="text-sm text-alert bg-alert/10 border border-alert/30 rounded px-3 py-2">
          {searchParams.error}
        </p>
      )}
      {searchParams.ok && (
        <p className="text-sm text-ok bg-ok/10 border border-ok/30 rounded px-3 py-2">{searchParams.ok}</p>
      )}

      <Card title="Add someone from the company">
        <form action={createStaffUser} className="p-4 space-y-3">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Name">
              <input name="name" required className="input" />
            </Field>
            <Field label="Username">
              <input name="username" required autoCapitalize="none" className="input" />
            </Field>
            <Field label="Password">
              <input name="password" type="password" required minLength={8} className="input" />
            </Field>
            <Field label="Role">
              <select name="role" className="input" defaultValue="staff">
                <option value="staff">Staff — keeps the books</option>
                <option value="owner">Owner — can manage accounts too</option>
              </select>
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn">Create account</button>
            <span className="text-xs text-mute">
              At least 8 characters. Tell them the password in person, not over a message.
            </span>
          </div>
        </form>
      </Card>

      <Card title="Accounts">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="th">Name</th>
                <th className="th">Username</th>
                <th className="th">Role</th>
                <th className="th">Last seen</th>
                <th className="th">New password</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className={user.active ? undefined : "opacity-50"}>
                  <td className="td font-medium">
                    {user.name}
                    {user.id === owner.id && <span className="text-xs text-mute"> (you)</span>}
                  </td>
                  <td className="td font-mono text-xs">{user.username}</td>
                  <td className="td">
                    <Pill kind={user.role === "owner" ? "watch" : "low"}>{user.role}</Pill>
                  </td>
                  <td className="td text-xs text-mute">{user.last_seen_at?.slice(0, 16).replace("T", " ") ?? "never"}</td>
                  <td className="td">
                    <form action={changePassword} className="flex gap-2">
                      <input type="hidden" name="id" value={user.id} />
                      <input name="password" type="password" minLength={8} placeholder="••••••••" className="input w-32" />
                      <button className="btn-quiet">Set</button>
                    </form>
                  </td>
                  <td className="td">
                    <div className="flex gap-2">
                      {user.id !== owner.id && (
                        <>
                          <form action={toggleUser}>
                            <input type="hidden" name="id" value={user.id} />
                            <input type="hidden" name="active" value={user.active === 1 ? "0" : "1"} />
                            <button className="btn-quiet">{user.active === 1 ? "Switch off" : "Switch on"}</button>
                          </form>
                          <form action={removeUser}>
                            <input type="hidden" name="id" value={user.id} />
                            <button className="btn-quiet text-alert border-alert/30">Delete</button>
                          </form>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-3 border-t border-line text-xs text-mute">
          Changing someone&rsquo;s password signs them out of every device they were using.
        </p>
      </Card>

      <Card title="Reaching Bhargo from outside the office">
        <div className="p-4 text-sm text-mute space-y-2">
          <p>
            These accounts decide <em>who</em> may sign in. Where the app can be reached from is a
            separate question, and the safer place to answer it:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Office machine only</strong> — run it on one computer and use it there. Nothing
              else can reach it.
            </li>
            <li>
              <strong>Office network</strong> — run it on one machine, open{" "}
              <code className="font-mono text-xs">http://that-machine:3000</code> from the others. Fine
              behind your own router; do not forward the port.
            </li>
            <li>
              <strong>Site staff too</strong> — put the company&rsquo;s devices on a private network
              (Tailscale, WireGuard, or your own VPN). Bhargo then answers only to devices you added.
            </li>
            <li>
              <strong>On the open internet</strong> — only behind HTTPS, with{" "}
              <code className="font-mono text-xs">BHARGO_SECURE_COOKIES=1</code> set. Anyone in the
              world can then reach the sign-in page, so passwords become the only wall.
            </li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
