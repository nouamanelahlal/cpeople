import type { JSX } from 'react';
import { AppPage, appContext } from '../_shell/app-page';
import { ModulePlaceholder } from '../_shell/module-placeholder';

/** The declarations module, shown at its own workshop (HR-01 spec 6.13). */
export default async function DeclarationsPage(): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  return (
    <AppPage context={context} current="declarations" title={t.shell.nav.declarations} subtitle={t.modules.hr03}>
      <ModulePlaceholder
        icon="declaration"
        title={t.shell.nav.declarations}
        body={t.modules.declarations}
        when={t.modules.hr03}
      />
    </AppPage>
  );
}
