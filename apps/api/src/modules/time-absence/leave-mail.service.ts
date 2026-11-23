import { Injectable } from '@nestjs/common';
import { getMessages, intlLocale, toLocale, type Locale, type Messages } from '@cpeople/shared';
import { MailService } from '../../common/mail/mail.service.js';

/**
 * The notices leave sends (HR-02 spec, point 5).
 *
 * Two rules decide everything in this file, and both are the client's:
 *
 *  - **the recipient's language.** Salma reads French and Rachid reads English,
 *    and each is written to in theirs — taken from the employee file, not from
 *    whoever happened to press the button.
 *  - **nothing private travels.** A message carries who, which dates, how many
 *    days, and a link back into CPeople. It never carries the reason somebody
 *    gave, and it never carries anything medical. The reason stays on the
 *    request, behind sign-in, where only the people entitled to it can read it.
 */
export type LeaveMailKind =
  | 'submitted'
  | 'approvedForYou'
  | 'rejectedForYou'
  | 'secondApproval'
  | 'cancellationRequested'
  | 'cancellationDecided'
  | 'recalculated';

export interface LeaveMailRecipient {
  readonly email?: string | null;
  readonly preferredLocale?: string | null;
}

export interface LeaveMailFacts {
  /** Whose leave it is. A name is not private; a reason is. */
  readonly name: string;
  readonly from: string;
  readonly to: string;
  readonly days: number;
  /** Which tab of /leave the link should open. */
  readonly tab: 'mine' | 'approvals' | 'all' | 'review';
  readonly requestId?: string;
}

@Injectable()
export class LeaveMailService {
  constructor(private readonly mail: MailService) {}

  async send(
    kind: LeaveMailKind,
    recipient: LeaveMailRecipient,
    facts: LeaveMailFacts,
  ): Promise<boolean> {
    if (!recipient.email) {
      return false;
    }

    const locale = toLocale(recipient.preferredLocale ?? undefined);
    const t = getMessages(locale);
    const template = t.leave.mail[kind];

    const values = {
      name: facts.name,
      from: longDate(facts.from, locale),
      to: longDate(facts.to, locale),
      days: formatDays(facts.days, locale),
    };

    return this.mail.send({
      to: recipient.email,
      subject: fill(template.subject, values),
      body: fill(template.body, values),
      link: { url: this.mail.url(this.#path(facts)), label: t.leave.mail.open },
      footer: t.leave.mail.footer,
    });
  }

  /**
   * Where a message points.
   *
   * At the tab the reader needs, not at a generic home screen: an approver
   * opening their mail on a telephone should land on the thing waiting for them.
   */
  #path(facts: LeaveMailFacts): string {
    const tab = facts.tab === 'mine' ? '' : `?tab=${facts.tab}`;
    return facts.requestId ? `/leave/${facts.requestId}` : `/leave${tab}`;
  }
}

/** Swaps {name} and friends for their values. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
}

function longDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00.000Z`));
}

function formatDays(days: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 }).format(days);
}

/** The message tree, for anything that wants to read it without sending. */
export type LeaveMessages = Messages['leave'];
