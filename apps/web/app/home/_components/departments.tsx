import type { JSX } from 'react';
import type { Formatter } from '../../../lib/format';

export interface DepartmentCount {
  readonly code: string;
  readonly name: string;
  readonly count: number;
}

/**
 * Where the headcount sits (M01 / HR-01).
 *
 * Counted by the API over the files this person may see, so a manager's chart is
 * their own branch and an HR manager's is the company.
 */
export function Departments({
  departments,
  total,
  fixedTerm,
  f,
}: {
  departments: readonly DepartmentCount[];
  total: number;
  fixedTerm: number;
  f: Formatter;
}): JSX.Element {
  const t = f.t.home.departments;
  const largest = Math.max(1, ...departments.map((department) => department.count));

  return (
    <section
      aria-labelledby="departments-title"
      className="flex min-w-0 shrink grow basis-[300px] flex-col gap-[18px] rounded-[20px] border border-card-border bg-white p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="departments-title" className="text-lg font-semibold text-navy">
          {t.title}
        </h2>
        <p className="num text-[13px] text-body">
          {f.text(t.note, {
            count: { kind: 'count', value: total },
            fixedTerm: { kind: 'count', value: fixedTerm },
          })}
        </p>
      </div>

      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {departments.map((department) => (
          <li key={department.code} className="flex flex-col gap-2">
            <span className="flex justify-between text-sm text-navy">
              <span>{department.name}</span>
              <span className="num font-semibold">{f.count(department.count)}</span>
            </span>
            {/* The bar is the same number again, drawn: it is marked decorative so a
                screen reader hears the count once. */}
            <span aria-hidden="true" className="block h-2 rounded-lg bg-line">
              <span
                className="block h-full rounded-lg bg-cyan"
                style={{ inlineSize: `${Math.round((department.count / largest) * 100)}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
