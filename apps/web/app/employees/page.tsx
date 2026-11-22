import type { JSX } from 'react';
import { AppPage, appContext } from '../_shell/app-page';
import { ModulePlaceholder } from '../_shell/module-placeholder';

/** Part of the HR-01 build; the real screen lands in a later step. */
export default async function EmployeesPage(): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  return (
    <AppPage context={context} current="employees" title={t.shell.nav.employees} subtitle={t.modules.hr01}>
      <ModulePlaceholder
        icon="users"
        title={t.shell.nav.employees}
        body={t.modules.building}
        when={t.modules.hr01}
      />
    </AppPage>
  );
}
