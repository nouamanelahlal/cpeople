import type { JSX } from 'react';
import { AppPage, appContext } from '../_shell/app-page';
import { ModulePlaceholder } from '../_shell/module-placeholder';

/** The sap-posting module, shown at its own workshop (HR-01 spec 6.13). */
export default async function SapPostingPage(): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  return (
    <AppPage context={context} current="sapPosting" title={t.shell.nav.sapPosting} subtitle={t.modules.hr03}>
      <ModulePlaceholder
        icon="sap"
        title={t.shell.nav.sapPosting}
        body={t.modules.sapPosting}
        when={t.modules.hr03}
      />
    </AppPage>
  );
}
