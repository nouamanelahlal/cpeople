import type { JSX } from 'react';
import { AppPage, appContext } from '../_shell/app-page';
import { ModulePlaceholder } from '../_shell/module-placeholder';

/** The leave module, shown at its own workshop (HR-01 spec 6.13). */
export default async function LeavePage(): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  return (
    <AppPage context={context} current="leave" title={t.shell.nav.leave} subtitle={t.modules.hr02}>
      <ModulePlaceholder
        icon="calendar"
        title={t.shell.nav.leave}
        body={t.modules.leave}
        when={t.modules.hr02}
      />
    </AppPage>
  );
}
