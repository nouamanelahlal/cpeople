'use client';

import { useState, type JSX } from 'react';
import { saveDepartment } from '../actions';

/**
 * Changing one department (HR-01 spec 6.5).
 *
 * The question the spec asks for — "apply to 46 people?" — is asked here,
 * before anything is sent, and only when the cost centre has actually been
 * changed: nobody should be asked whether to move people when nothing is
 * moving. Who follows is decided by the API, which skips anyone placed in a
 * cost centre deliberately.
 */
export function DepartmentForm({
  department,
  costCentres,
  sites,
  labels,
}: {
  department: {
    id: string;
    name: string;
    costCentreCode: string;
    siteCode: string;
    headEmployeeId: string;
    headcount: number;
    overrides: number;
  };
  costCentres: readonly { code: string; name: string }[];
  sites: readonly { code: string; name: string }[];
  labels: {
    name: string;
    costCentre: string;
    site: string;
    none: string;
    apply: string;
    applyNote: string;
    save: string;
    cancel: string;
    cancelHref: string;
  };
}): JSX.Element {
  const [centre, setCentre] = useState(department.costCentreCode);
  const moving = centre !== department.costCentreCode;

  return (
    <form action={saveDepartment} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={department.id} />
      <input type="hidden" name="headEmployeeId" value={department.headEmployeeId} />

      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-8 gap-y-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
            {labels.name}
          </span>
          <input
            type="text"
            name="name"
            defaultValue={department.name}
            className="h-11 rounded-xl border border-field-border bg-white px-3.5 text-sm text-navy"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
            {labels.costCentre}
          </span>
          <select
            name="costCentreCode"
            value={centre}
            onChange={(event) => setCentre(event.target.value)}
            className="h-11 rounded-xl border border-field-border bg-white px-3 text-sm text-navy"
          >
            <option value="">{labels.none}</option>
            {costCentres.map((option) => (
              <option key={option.code} value={option.code}>
                {option.code} · {option.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
            {labels.site}
          </span>
          <select
            name="siteCode"
            defaultValue={department.siteCode}
            className="h-11 rounded-xl border border-field-border bg-white px-3 text-sm text-navy"
          >
            <option value="">—</option>
            {sites.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {moving && (
        <div className="flex flex-col gap-2 rounded-2xl border border-card-border bg-surface-quiet p-4">
          <label className="flex items-center gap-2.5 text-sm font-semibold text-navy">
            <input
              type="checkbox"
              name="applyToEmployees"
              defaultChecked
              className="size-4 accent-[var(--color-blue)]"
            />
            {labels.apply}
          </label>
          <p className="m-0 max-w-prose text-[13px] text-body">{labels.applyNote}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="h-11 rounded-xl bg-blue px-5 text-sm font-semibold text-white transition-[background-color,box-shadow] duration-200 ease-out hover:bg-blue-hover"
        >
          {labels.save}
        </button>
        <a
          href={labels.cancelHref}
          className="quiet-button h-11 border-button-border px-4 text-[13px] font-semibold text-navy"
        >
          {labels.cancel}
        </a>
      </div>
    </form>
  );
}
