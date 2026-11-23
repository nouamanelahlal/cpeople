import type { TenantClient } from '@cpeople/db';
import { addDays } from '@cpeople/shared';

/**
 * "Which documents are running out?", as a database can be asked it
 * (HR-01 spec 6.7).
 *
 * How soon counts as soon belongs to the kind of document — sixty days for a
 * residence permit, thirty for a medical certificate — so there is no single
 * window to compare against. There is one window per kind, and the question is
 * the union of them.
 *
 * The figure on the home screen and the filter on the employee list both ask
 * through here, so the card and the list it opens can only ever agree.
 */
export type ExpiringFilter = { documentTypeId: string; expiryDate: { gte: Date; lte: Date } }[];

export async function expiringDocumentFilter(
  tx: TenantClient,
  today: string,
): Promise<ExpiringFilter> {
  const types = await tx.documentType.findMany({
    where: { requiresExpiry: true },
    select: { id: true, alertDaysBefore: true },
  });

  const from = new Date(`${today}T00:00:00Z`);

  return types.map((type) => ({
    documentTypeId: type.id,
    expiryDate: { gte: from, lte: new Date(`${addDays(today, type.alertDaysBefore)}T00:00:00Z`) },
  }));
}

/**
 * The same question with nothing matching, for the case where no kind of
 * document expires at all: an empty `OR` matches everything, which would be the
 * opposite of the answer.
 */
export function orNothing(filter: ExpiringFilter): { OR: ExpiringFilter } | { id: string } {
  return filter.length > 0 ? { OR: filter } : { id: '00000000-0000-0000-0000-000000000000' };
}
