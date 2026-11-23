import type { JSX } from 'react';
import { AppPage, appContext } from '../_shell/app-page';
import { ModulePlaceholder } from '../_shell/module-placeholder';

/** The expenses module, shown at its own workshop (HR-01 spec 6.13). */
export default async function ExpensesPage(): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  return (
    <AppPage context={context} current="expenses" title={t.shell.nav.expenses} subtitle={t.modules.later}>
      <ModulePlaceholder
        icon="expense"
        title={t.shell.nav.expenses}
        body={t.modules.expenses}
        when={t.modules.later}
      />
    </AppPage>
  );
}
