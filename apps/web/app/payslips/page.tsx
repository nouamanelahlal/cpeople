import type { JSX } from 'react';
import { AppPage, appContext } from '../_shell/app-page';
import { ModulePlaceholder } from '../_shell/module-placeholder';

/** The payslips module, shown at its own workshop (HR-01 spec 6.13). */
export default async function PayslipsPage(): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  return (
    <AppPage context={context} current="payslips" title={t.shell.nav.payslips} subtitle={t.modules.hr03}>
      <ModulePlaceholder
        icon="payslip"
        title={t.shell.nav.payslips}
        body={t.modules.payslips}
        when={t.modules.hr03}
      />
    </AppPage>
  );
}
