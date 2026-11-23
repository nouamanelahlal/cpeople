import type { Locale } from '../locale.js';
import { en } from './en.js';
import { fr } from './fr.js';

/** Every string the UI shows comes from here, so French is never an afterthought. */
export type Messages = typeof en;

const MESSAGES: Record<Locale, Messages> = { en, fr };

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}

export { en, fr };
