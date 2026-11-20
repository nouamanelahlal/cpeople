import type { Locale } from '../locale';
import { en } from './en';
import { fr } from './fr';

/** Every string the UI shows comes from here, so French is never an afterthought. */
export type Messages = typeof en;

const MESSAGES: Record<Locale, Messages> = { en, fr };

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}

export { en, fr };
