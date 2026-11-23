import type { JSX } from 'react';
import type { EmployeeDocument, EmployeeDocuments } from '../../../../lib/employee-file';
import type { Formatter } from '../../../../lib/format';
import { removeDocument } from '../documents-actions';
import { Pill } from './file-parts';

/**
 * The documents on a file, and what is about to run out (HR-01 spec 6.7).
 *
 * The status of each one is the API's answer, not a calculation repeated here:
 * the same rule decides the figure on the home screen, the filter on the list,
 * the dot on a row and this pill, so the four can never disagree.
 *
 * A document of a private kind — a copy of an identity card, a bank certificate —
 * is listed for anyone who may see the file and opened only by the roles that may
 * see that person's private fields. Knowing a medical certificate is on file and
 * when it expires is a manager's business; reading it is not.
 */
export function DocumentsTab({
  data,
  employeeId,
  f,
}: {
  data: EmployeeDocuments;
  employeeId: string;
  f: Formatter;
}): JSX.Element {
  const t = f.t.employeeFile.documents;

  if (data.documents.length === 0) {
    return <p className="m-0 text-sm text-body">{t.empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{t.title}</caption>
        <thead>
          <tr>
            <Header label={t.columns.type} />
            <Header label={t.columns.fileName} />
            <Header label={t.columns.issued} className="hidden sm:table-cell" />
            <Header label={t.columns.expires} />
            <Header label={t.columns.state} />
            <Header label={t.columns.uploadedBy} className="hidden lg:table-cell" />
            <Header label="" />
          </tr>
        </thead>

        <tbody>
          {data.documents.map((document) => (
            <Row key={document.id} document={document} employeeId={employeeId} f={f} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({
  document,
  employeeId,
  f,
}: {
  document: EmployeeDocument;
  employeeId: string;
  f: Formatter;
}): JSX.Element {
  const t = f.t.employeeFile.documents;

  return (
    <tr className="border-t border-line align-middle">
      <td className="py-3 pe-4 font-semibold text-navy">{document.type.name}</td>

      <td className="py-3 pe-4 text-body">
        {document.mayOpen ? (
          <a href={`/documents/${document.id}`} target="_blank" rel="noreferrer" title={t.openNote}>
            {document.fileName}
          </a>
        ) : (
          <span title={document.mayDelete ? t.noFile : t.notYours}>{document.fileName}</span>
        )}
        <span className="num ms-2 text-xs text-muted">
          {f.plain(t.size, { size: f.count(Math.max(1, Math.round(document.byteSize / 1024))) })}
        </span>
      </td>

      <td className="num hidden whitespace-nowrap py-3 pe-4 text-body sm:table-cell">
        {document.issueDate ? f.dateMedium(document.issueDate) : '—'}
      </td>

      <td className="num whitespace-nowrap py-3 pe-4 text-body">
        {document.expiryDate ? f.dateMedium(document.expiryDate) : t.noExpiry}
      </td>

      <td className="py-3 pe-4">
        <State document={document} f={f} />
      </td>

      <td className="hidden py-3 pe-4 text-body lg:table-cell">{document.uploadedBy ?? '—'}</td>

      <td className="py-3 text-end">
        {document.mayDelete && (
          <form action={removeDocument}>
            <input type="hidden" name="id" value={employeeId} />
            <input type="hidden" name="documentId" value={document.id} />
            <button
              type="submit"
              className="quiet-button h-9 border-button-border px-3 text-xs font-semibold text-navy"
            >
              {t.remove}
            </button>
          </form>
        )}
      </td>
    </tr>
  );
}

/**
 * How long this one has left, in words.
 *
 * "Expires in 7 days" rather than a colour, because the number is the thing HR
 * acts on — and because a pill that only changes colour says nothing to someone
 * who cannot see the difference.
 */
function State({ document, f }: { document: EmployeeDocument; f: Formatter }): JSX.Element {
  const t = f.t.employeeFile.documents.state;
  const days = document.daysLeft ?? 0;

  if (document.state === 'expired') {
    return (
      <Pill tone="warning">
        {days === 0
          ? t.expired
          : f.plain(t.expiredDays, { days: f.count(Math.abs(days)) })}
      </Pill>
    );
  }

  if (document.state === 'expiring') {
    return (
      <Pill tone="warning">
        {days === 0 ? t.expiringToday : f.plain(t.expiring, { days: f.count(days) })}
      </Pill>
    );
  }

  return <Pill tone="quiet">{t.valid}</Pill>;
}

function Header({ label, className = '' }: { label: string; className?: string }): JSX.Element {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap border-b border-line pb-2.5 pe-4 text-start text-xs font-semibold uppercase tracking-[0.04em] text-muted ${className}`}
    >
      {label}
    </th>
  );
}
