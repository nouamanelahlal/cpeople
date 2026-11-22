import type { JSX } from 'react';
import { AppPage, appContext } from '../_shell/app-page';
import { ModulePlaceholder } from '../_shell/module-placeholder';

/** The payroll module, shown at its own workshop (HR-01 spec 6.13). */
export default async function PayrollPage(): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  return (
    <AppPage context={context} current="payroll" title={t.shell.nav.payroll} subtitle={t.modules.hr03}>
      <ModulePlaceholder
        icon="pay"
        title={t.shell.nav.payroll}
        body={t.modules.payroll}
        when={t.modules.hr03}
      />
    </AppPage>
  );
}
