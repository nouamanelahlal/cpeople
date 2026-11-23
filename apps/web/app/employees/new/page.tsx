import type { JSX } from 'react';
import { CURRENCY } from '@cpeople/shared';
import { apiGetOrNull } from '../../../lib/api';
import { AppPage, appContext } from '../../_shell/app-page';
import { HireWizard } from './_components/hire-wizard';

/** What the wizard may offer, from the API: nothing is invented in the browser. */
interface HireOptions {
  readonly positions: readonly {
    readonly code: string;
    readonly title: string;
    readonly department: string;
    readonly departmentCode: string;
    readonly siteCode?: string;
  }[];
  readonly sites: readonly { readonly code: string; readonly name: string }[];
  readonly contractTypes: readonly {
    readonly code: string;
    readonly name: string;
    readonly requiresEndDate: boolean;
    readonly defaultTrialDays?: number;
  }[];
  readonly managers: readonly {
    readonly id: string;
    readonly name: string;
    readonly departmentCode: string;
  }[];
  readonly today: string;
  readonly nextEmployeeNumber: string;
}

/**
 * Hiring somebody (HR-01 spec 6.4).
 *
 * Six steps, and nothing exists until the last one: a half-created person in
 * the database is worse than a form that has to be filled in again. The draft
 * lives in the browser while it is being filled in, and the whole of it is sent
 * once.
 */
export default async function NewEmployeePage(): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  const options = await apiGetOrNull<HireOptions>('/employees/new');

  if (options === null) {
    return (
      <AppPage context={context} current="employees" title={t.hire.title} subtitle={t.hire.notYours}>
        <section className="rounded-[20px] border border-card-border bg-white p-6">
          <p className="m-0 text-sm text-body">{t.hire.notYours}</p>
        </section>
      </AppPage>
    );
  }

  return (
    <AppPage context={context} current="employees" title={t.hire.title} subtitle={t.hire.subtitle}>
      <HireWizard
        options={options}
        t={{
          step: t.hire.step,
          steps: t.hire.steps,
          back: t.hire.back,
          next: t.hire.next,
          create: t.hire.create,
          creating: t.hire.creating,
          edit: t.hire.edit,
          fields: t.hire.fields,
          gender: t.employeeFile.gender,
          maritalStatus: t.employeeFile.maritalStatus,
          cnssPending: t.hire.cnssPending,
          ribNote: t.hire.ribNote,
          ribWarning: t.hire.ribWarning,
          endRequired: t.hire.endRequired,
          trialNote: t.hire.trialNote,
          numberNote: t.hire.numberNote,
          addDependent: t.hire.addDependent,
          removeDependent: t.hire.removeDependent,
          noDependents: t.hire.noDependents,
          relation: t.hire.relation,
          spouse: t.hire.spouse,
          child: t.hire.child,
          pickPosition: t.hire.pickPosition,
          pickManager: t.hire.pickManager,
          pickSite: t.hire.pickSite,
          duplicate: t.hire.duplicate,
          duplicateOpen: t.hire.duplicateOpen,
          failed: t.hire.failed,
          reviewNote: t.hire.reviewNote,
          required: t.hire.required,
          optional: t.hire.optional,
          currency: CURRENCY,
        }}
      />
    </AppPage>
  );
}
