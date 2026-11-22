import type { JSX } from 'react';
import { AppPage, appContext } from '../_shell/app-page';
import { ModulePlaceholder } from '../_shell/module-placeholder';

/** The settings module, shown at its own workshop (HR-01 spec 6.13). */
export default async function SettingsPage(): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  return (
    <AppPage context={context} current="settings" title={t.shell.nav.settings} subtitle={t.modules.hr01}>
      <ModulePlaceholder
        icon="settings"
        title={t.shell.nav.settings}
        body={t.modules.settings}
        when={t.modules.hr01}
      />
    </AppPage>
  );
}
