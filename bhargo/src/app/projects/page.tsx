import { addProject, editProject, removeProject } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { Card, Empty, Field } from "@/components/ui";
import { getSettings, listAttendance, listProjects, listPurchases, listWorkers } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { labourSummary } from "@/lib/payroll";
import { rollupByMaterial } from "@/lib/variance";

export const dynamic = "force-dynamic";

export default function ProjectsPage() {
  requireUser();
  const settings = getSettings();
  const projects = listProjects();
  const workers = listWorkers();
  const money = (n: number) => formatMoney(Math.round(n), settings.currency);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl sm:text-2xl font-semibold">Builds</h1>
        <p className="text-mute text-sm mt-1 max-w-2xl">
          Floor area is the one field worth getting right — every comparison between builds is done
          per square foot, so a wrong area quietly bends all of it.
        </p>
      </header>

      <Card title="Add a build">
        <form action={addProject} className="p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Name" className="lg:col-span-2">
            <input name="name" required placeholder="Hill Road house" className="input" />
          </Field>
          <Field label="Site">
            <input name="site" placeholder="Plot 3" className="input" />
          </Field>
          <Field label="Built-up area (sq.ft)">
            <input name="area_sqft" type="number" step="1" min="1" required className="input" />
          </Field>
          <Field label="Started on">
            <input name="started_on" type="date" defaultValue={today} className="input" />
          </Field>
          <Field label="Finished on" hint="Leave empty while it is still running">
            <input name="ended_on" type="date" className="input" />
          </Field>
          <Field label="Status">
            <select name="status" className="input" defaultValue="active">
              <option value="planning">Planning</option>
              <option value="active">In progress</option>
              <option value="done">Finished</option>
            </select>
          </Field>
          <div className="flex items-end">
            <button className="btn w-full">Add build</button>
          </div>
        </form>
      </Card>

      {projects.length === 0 ? (
        <Card>
          <Empty>No builds yet.</Empty>
        </Card>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => {
            const spend = rollupByMaterial(listPurchases({ projectId: project.id })).reduce(
              (sum, r) => sum + r.amount,
              0
            );
            const labour = labourSummary(project, workers, listAttendance({ projectId: project.id }), settings);
            const total = spend + labour.totalCost;

            return (
              <Card
                key={project.id}
                title={project.name}
                subtitle={`${project.area_sqft.toLocaleString("en-IN")} sq.ft · ${money(total)} spent · ${money(
                  total / (project.area_sqft || 1)
                )} per sq.ft (materials ${money(spend)}, labour ${money(labour.totalCost)})`}
              >
                <form action={editProject} className="p-4 grid sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                  <input type="hidden" name="id" value={project.id} />
                  <Field label="Name" className="lg:col-span-2">
                    <input name="name" defaultValue={project.name} className="input" />
                  </Field>
                  <Field label="Site">
                    <input name="site" defaultValue={project.site ?? ""} className="input" />
                  </Field>
                  <Field label="Area (sq.ft)">
                    <input name="area_sqft" type="number" defaultValue={project.area_sqft} className="input" />
                  </Field>
                  <Field label="Started">
                    <input name="started_on" type="date" defaultValue={project.started_on} className="input" />
                  </Field>
                  <Field label="Finished">
                    <input name="ended_on" type="date" defaultValue={project.ended_on ?? ""} className="input" />
                  </Field>
                  <Field label="Status">
                    <select name="status" defaultValue={project.status} className="input">
                      <option value="planning">Planning</option>
                      <option value="active">In progress</option>
                      <option value="done">Finished</option>
                    </select>
                  </Field>
                  <Field label="Notes" className="lg:col-span-4">
                    <input name="notes" defaultValue={project.notes ?? ""} className="input" />
                  </Field>
                  <button className="btn">Save</button>
                </form>
                <div className="px-4 pb-4 no-print">
                  <form action={removeProject}>
                    <input type="hidden" name="id" value={project.id} />
                    <button className="btn-quiet text-alert border-alert/30">
                      Delete build and everything recorded against it
                    </button>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
