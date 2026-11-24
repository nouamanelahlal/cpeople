import type { JSX, ReactNode } from 'react';
import { apiGetOrNull } from '../../../lib/api';
import { AppPage, appContext } from '../../_shell/app-page';
import { saveMapping } from './actions';

export interface SourceMapping {
  readonly employeeNumber: string;
  readonly timestamp: string;
  readonly direction: string;
  readonly deviceId: string;
}

export interface Source {
  readonly id: string;
  readonly name: string;
  readonly type: 'file' | 'api';
  readonly status: 'active' | 'planned';
  readonly mapping: SourceMapping;
  readonly timezone: string;
  readonly duplicateWindowSeconds: number;
}

/**
 * Where punches come from (HR-02 build spec §5.1 and §5.7).
 *
 * Two cards. The first is the daily file and it works: the mapping on it is the
 * answer to "our device calls that column something else", and it is a setting
 * rather than a release.
 *
 * The second is the device API, and it is **switched off on purpose**, with the
 * reason and the date it waits on. Its fields are visible and disabled, so that
 * SMG can see what we will need from the provider without anybody being able to
 * press something that does nothing.
 */
export default async function AttendanceSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  const query = await searchParams;
  const data = await apiGetOrNull<{ sources: Source[]; mayManage: boolean }>(
    '/attendance/sources',
  );

  if (data === null) {
    return (
      <AppPage
        context={context}
        current="settings"
        title={t.attendance.source.title}
        subtitle={t.attendance.notYours}
      >
        <Card>
          <p className="m-0 text-sm text-body">{t.attendance.notYours}</p>
        </Card>
      </AppPage>
    );
  }

  const file = data.sources.find((source) => source.type === 'file');
  const api = data.sources.find((source) => source.type === 'api');

  return (
    <AppPage
      context={context}
      current="settings"
      title={t.attendance.source.title}
      subtitle={t.attendance.source.note}
    >
      {one(query['saved']) === '1' && (
        <p className="m-0 rounded-2xl border border-success-border bg-success-bg px-4 py-3 text-sm text-success-ink">
          {t.attendance.source.saved}
        </p>
      )}

      {one(query['error']) === '1' && (
        <p
          role="alert"
          className="m-0 rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-ink"
        >
          {t.attendance.source.failed}
        </p>
      )}

      {file && (
        <Card>
          <h2 className="m-0 text-lg font-semibold text-navy">{file.name}</h2>

          <form action={saveMapping} className="flex flex-col gap-5">
            <input type="hidden" name="id" value={file.id} />

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {[t.attendance.source.columns.field, t.attendance.source.columns.column].map(
                      (label) => (
                        <th
                          key={label}
                          scope="col"
                          className="border-b border-line pb-2.5 pe-4 text-start text-xs font-semibold uppercase tracking-[0.04em] text-muted"
                        >
                          {label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>

                <tbody>
                  {(
                    ['employeeNumber', 'timestamp', 'direction', 'deviceId'] as const
                  ).map((field) => (
                    <tr key={field} className="border-t border-line">
                      <th scope="row" className="py-3 pe-4 text-start font-semibold text-navy">
                        {t.attendance.source.fields[field]}
                      </th>
                      <td className="py-3">
                        <input
                          type="text"
                          name={field}
                          defaultValue={file.mapping[field]}
                          disabled={!data.mayManage}
                          className={`${INPUT} w-full max-w-xs font-mono`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-8 gap-y-5">
              <Field id="timezone" label={t.attendance.source.timezone}>
                <input
                  type="text"
                  id="timezone"
                  name="timezone"
                  defaultValue={file.timezone}
                  disabled={!data.mayManage}
                  className={INPUT}
                />
              </Field>

              <Field id="duplicateWindowSeconds" label={t.attendance.source.duplicateWindow}>
                <input
                  type="number"
                  min={0}
                  max={3600}
                  id="duplicateWindowSeconds"
                  name="duplicateWindowSeconds"
                  defaultValue={file.duplicateWindowSeconds}
                  disabled={!data.mayManage}
                  className={INPUT}
                />
              </Field>
            </div>

            {data.mayManage && (
              <button type="submit" className={PRIMARY}>
                {t.attendance.source.save}
              </button>
            )}
          </form>
        </Card>
      )}

      {api && (
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="m-0 text-lg font-semibold text-navy">{api.name}</h2>
            <span className="rounded-full bg-surface-quiet px-2.5 py-[5px] text-xs font-semibold text-muted">
              {t.attendance.source.planned}
            </span>
          </div>

          <p className="m-0 max-w-prose text-[13px] text-body">
            {t.attendance.source.plannedNote}
          </p>

          {/* Visible and disabled: SMG can see what the provider will have to
              give us, and nobody can press a button that does nothing. */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-8 gap-y-5 opacity-60">
            <Field id="endpoint" label={t.attendance.source.endpoint}>
              <input type="text" id="endpoint" value="" readOnly disabled className={INPUT} />
            </Field>
            <Field id="authentication" label={t.attendance.source.authentication}>
              <input type="text" id="authentication" value="" readOnly disabled className={INPUT} />
            </Field>
            <Field id="schedule" label={t.attendance.source.schedule}>
              <input type="text" id="schedule" value="" readOnly disabled className={INPUT} />
            </Field>
            <Field id="lastSync" label={t.attendance.source.lastSync}>
              <input
                type="text"
                id="lastSync"
                value={t.attendance.source.never}
                readOnly
                disabled
                className={INPUT}
              />
            </Field>
          </div>
        </Card>
      )}

      <a href="/attendance" className="text-sm font-semibold text-blue">
        {t.attendance.title}
      </a>
    </AppPage>
  );
}

const INPUT = 'h-11 rounded-xl border border-field-border bg-white px-3.5 text-sm text-navy';
const PRIMARY =
  'h-11 w-fit rounded-xl bg-blue px-5 text-sm font-semibold text-white transition-[background-color] duration-200 ease-out hover:bg-blue-hover';

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

function Card({ children }: { children: ReactNode }): JSX.Element {
  return (
    <section className="flex flex-col gap-5 rounded-[20px] border border-card-border bg-white p-6">
      {children}
    </section>
  );
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
