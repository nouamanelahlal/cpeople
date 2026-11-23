import type { JSX } from 'react';
import type { KcContext } from '../KcContext';
import { Alert } from '../components/SignInLayout';

/**
 * The one message a page shows.
 *
 * Keycloak reports the same problem twice — once as a page message and once against
 * the field — and showing both put the same sentence on screen two running. This
 * picks the page message when there is one and the field message otherwise, so
 * exactly one appears.
 *
 * The wording is ours: every key these messages come from is overridden in
 * i18n.ts, so none of Keycloak's own text reaches a person. What to do about it is
 * not here: the sign-in page puts one help line under whatever this shows.
 */
export function PageMessage(props: {
  kcContext: KcContext;
  /** Field whose error stands in when there is no page message, e.g. "username". */
  field?: string;
}): JSX.Element | null {
  const { kcContext, field } = props;
  const { message } = kcContext;

  const fieldError =
    field !== undefined &&
    'messagesPerField' in kcContext &&
    kcContext.messagesPerField.existsError(field)
      ? kcContext.messagesPerField.getFirstError(field)
      : undefined;

  const summary = message?.summary ?? fieldError;
  const kind = message?.type ?? (fieldError === undefined ? undefined : 'error');

  if (summary === undefined || kind === undefined) {
    return null;
  }

  return (
    <Alert kind={kind === 'error' ? 'error' : kind === 'success' ? 'success' : 'info'}>
      {summary}
    </Alert>
  );
}
