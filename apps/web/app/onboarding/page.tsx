import type { JSX } from 'react';
import { AppPage, appContext } from '../_shell/app-page';
import { ModulePlaceholder } from '../_shell/module-placeholder';

/** Part of the HR-01 build; the real screen lands in a later step. */
export default async function OnboardingPage(): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  return (
    <AppPage context={context} current="onboarding" title={t.shell.nav.onboarding} subtitle={t.modules.hr01}>
      <ModulePlaceholder
        icon="onboard"
        title={t.shell.nav.onboarding}
        body={t.modules.building}
        when={t.modules.hr01}
      />
    </AppPage>
  );
}
