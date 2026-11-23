'use client';

import { useState, type JSX } from 'react';
import type { DocumentType } from '../../../../lib/employee-file';
import { uploadDocument } from '../documents-actions';

/**
 * Adding a document to a file (HR-01 spec 6.7).
 *
 * A plain form with a file field, posting to the API through a server action.
 * The one thing the browser decides is whether the expiry date is required,
 * because that depends on the kind of document just chosen and asking the server
 * between two fields of one form would be absurd. The API checks it again.
 */
export function UploadForm({
  employeeId,
  types,
  labels,
}: {
  employeeId: string;
  types: readonly DocumentType[];
  labels: {
    type: string;
    file: string;
    fileNote: string;
    issueDate: string;
    expiryDate: string;
    expiryRequired: string;
    note: string;
    upload: string;
    cancel: string;
    cancelHref: string;
  };
}): JSX.Element {
  const [code, setCode] = useState(types[0]?.code ?? '');
  const chosen = types.find((type) => type.code === code);
  const needsExpiry = chosen?.requiresExpiry ?? false;

  return (
    <form action={uploadDocument} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={employeeId} />

      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-8 gap-y-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
            {labels.type}
          </span>
          <select
            name="type"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="h-11 rounded-xl border border-field-border bg-white px-3 text-sm text-navy"
          >
            {types.map((type) => (
              <option key={type.code} value={type.code}>
                {type.name}
              </option>
            ))}
          </select>
        </label>

        {/* The hint is described by the field rather than part of its label: a
            label that reads "File PDF, JPEG or PNG, up to 10 MB" is a label
            nobody — person or test — can call by its name. */}
        <div className="flex flex-col gap-1.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
              {labels.file}
            </span>
            <input
              type="file"
              name="file"
              required
              accept="application/pdf,image/jpeg,image/png"
              aria-describedby="document-file-note"
              className="rounded-xl border border-field-border bg-white p-2.5 text-sm text-navy file:me-3 file:rounded-lg file:border-0 file:bg-tint file:px-3 file:py-1.5 file:text-[13px] file:font-semibold file:text-blue"
            />
          </label>
          <p id="document-file-note" className="m-0 text-xs text-body">
            {labels.fileNote}
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
            {labels.issueDate}
          </span>
          <input
            type="date"
            name="issueDate"
            className="h-11 rounded-xl border border-field-border bg-white px-3.5 text-sm text-navy"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
              {labels.expiryDate}
            </span>
            <input
              type="date"
              name="expiryDate"
              required={needsExpiry}
              {...(needsExpiry ? { 'aria-describedby': 'document-expiry-note' } : {})}
              className="h-11 rounded-xl border border-field-border bg-white px-3.5 text-sm text-navy"
            />
          </label>
          {needsExpiry && (
            <p id="document-expiry-note" className="m-0 text-xs text-body">
              {labels.expiryRequired}
            </p>
          )}
        </div>

        <label className="col-span-full flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
            {labels.note}
          </span>
          <input
            type="text"
            name="note"
            className="h-11 rounded-xl border border-field-border bg-white px-3.5 text-sm text-navy"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="h-11 rounded-xl bg-blue px-5 text-sm font-semibold text-white transition-[background-color,box-shadow] duration-200 ease-out hover:bg-blue-hover"
        >
          {labels.upload}
        </button>
        <a
          href={labels.cancelHref}
          className="quiet-button h-11 border-button-border px-4 text-[13px] font-semibold text-navy"
        >
          {labels.cancel}
        </a>
      </div>
    </form>
  );
}
