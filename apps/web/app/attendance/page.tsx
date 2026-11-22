import type { JSX } from 'react';
import { AppPage, appContext } from '../_shell/app-page';
import { ModulePlaceholder } from '../_shell/module-placeholder';

/** The attendance module, shown at its own workshop (HR-01 spec 6.13). */
export default async function AttendancePage(): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  return (
    <AppPage context={context} current="attendance" title={t.shell.nav.attendance} subtitle={t.modules.hr02}>
      <ModulePlaceholder
        icon="clock"
        title={t.shell.nav.attendance}
        body={t.modules.attendance}
        when={t.modules.hr02}
      />
    </AppPage>
  );
}
