import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { DEFAULT_MAPPING } from './attendance-source.service.js';
import type { SampleRow } from './sample-export.service.js';

/**
 * The attendance file specification (HR-02 build spec §5.1).
 *
 * This is the one document that leaves the building. SMG sends it to the device
 * provider, and the provider either says "ours already looks like that" or
 * tells us what theirs looks like instead — which is the whole of P09.
 *
 * So it is written for somebody who has never seen CPeople: what the file is
 * for, one row per column with its format and an example, twenty real rows, and
 * the rules that are easy to get wrong. The last sheet is the one that saves
 * the argument: what happens to a night shift, a double badge, an unknown
 * number.
 */
@Injectable()
export class FileSpecService {
  async build(sample: readonly SampleRow[]): Promise<Buffer> {
    const book = new ExcelJS.Workbook();

    book.creator = 'CPeople by ConSAP';
    book.created = new Date();

    this.#readMe(book);
    this.#columns(book);
    this.#examples(book, sample);
    this.#rules(book);

    // ExcelJS types the result as its own Buffer shape; Node's is what callers want.
    return Buffer.from(await book.xlsx.writeBuffer());
  }

  #readMe(book: ExcelJS.Workbook): void {
    const sheet = book.addWorksheet('Read me');
    sheet.columns = [{ width: 110 }];

    const lines: [string, 'title' | 'heading' | 'text'][] = [
      ['CPeople — attendance file specification', 'title'],
      ['', 'text'],
      ['What this is', 'heading'],
      [
        'The format CPeople reads attendance punches in. Send it to the device provider and ask them ' +
          'to confirm that their export matches it, or to tell us how theirs differs.',
        'text',
      ],
      ['', 'text'],
      ['What we need back', 'heading'],
      ['1. A sample export from the real devices, covering a full week.', 'text'],
      ['2. Confirmation of the employee number format: how many digits, and whether leading zeros are used.', 'text'],
      ['3. Whether the file can be dropped automatically, or whether somebody uploads it.', 'text'],
      ['', 'text'],
      ['The shape of the file', 'heading'],
      ['CSV, semicolon-separated, with a header row. UTF-8. One punch per row.', 'text'],
      ['An .xlsx file with the same columns is read too.', 'text'],
      ['', 'text'],
      [
        'The column names below are what CPeople expects by default. Different names are fine: ' +
          'they are matched up once, in Settings, and then remembered.',
        'text',
      ],
      ['', 'text'],
      ['Nothing here is agreed yet. Every figure is a starting point for the HR-02 workshop.', 'text'],
    ];

    for (const [text, kind] of lines) {
      const row = sheet.addRow([text]);

      if (kind === 'title') {
        row.font = { size: 16, bold: true, color: { argb: 'FF0F1937' } };
      } else if (kind === 'heading') {
        row.font = { size: 12, bold: true, color: { argb: 'FF0E7BB0' } };
      } else {
        row.alignment = { wrapText: true, vertical: 'top' };
      }
    }
  }

  #columns(book: ExcelJS.Workbook): void {
    const sheet = book.addWorksheet('Columns');

    sheet.columns = [
      { header: 'Column', key: 'name', width: 20 },
      { header: 'Required', key: 'required', width: 11 },
      { header: 'Format', key: 'format', width: 34 },
      { header: 'Example', key: 'example', width: 22 },
      { header: 'Notes', key: 'notes', width: 62 },
    ];

    header(sheet);

    const rows = [
      {
        name: DEFAULT_MAPPING.employeeNumber,
        required: 'Yes',
        format: 'Digits, up to 10',
        example: '1007',
        notes:
          'The employee number, which is also the id the device knows the person by. ' +
          'This is what the punch is matched on. Leading zeros: please confirm.',
      },
      {
        name: DEFAULT_MAPPING.timestamp,
        required: 'Yes',
        format: 'YYYY-MM-DD HH:mm:ss or DD/MM/YYYY HH:mm',
        example: '2026-11-23 06:58:41',
        notes: 'Local time at the site (Africa/Casablanca). No timezone suffix.',
      },
      {
        name: DEFAULT_MAPPING.direction,
        required: 'No',
        format: 'IN or OUT',
        example: 'IN',
        notes:
          'If the device does not record a direction, leave the column out: punches are paired ' +
          'in order within the day, using the schedule to resolve an odd number.',
      },
      {
        name: DEFAULT_MAPPING.deviceId,
        required: 'No',
        format: 'Free text',
        example: 'KITCHEN-01',
        notes: 'Which reader recorded it. Useful when a site has more than one door.',
      },
    ];

    for (const row of rows) sheet.addRow(row);
    sheet.getColumn('notes').alignment = { wrapText: true, vertical: 'top' };
  }

  #examples(book: ExcelJS.Workbook, sample: readonly SampleRow[]): void {
    const sheet = book.addWorksheet('Example rows');

    sheet.columns = [
      { header: DEFAULT_MAPPING.employeeNumber, key: 'employeeNumber', width: 20 },
      { header: DEFAULT_MAPPING.timestamp, key: 'at', width: 24 },
      { header: DEFAULT_MAPPING.direction, key: 'direction', width: 12 },
      { header: DEFAULT_MAPPING.deviceId, key: 'deviceId', width: 18 },
    ];

    header(sheet);

    // Real rows from the sample export, so the two documents agree.
    for (const row of sample.slice(0, 20)) sheet.addRow(row);
  }

  #rules(book: ExcelJS.Workbook): void {
    const sheet = book.addWorksheet('Rules');

    sheet.columns = [
      { header: 'Situation', key: 'situation', width: 38 },
      { header: 'What CPeople does', key: 'does', width: 76 },
    ];

    header(sheet);

    const rows = [
      {
        situation: 'A shift crosses midnight',
        does:
          'The punches belong to the day the shift started. A pastry shift from 04:00 is one day; ' +
          'an evening shift ending at 00:30 belongs to the day before.',
      },
      {
        situation: 'The same person badges twice',
        does:
          'Two punches inside the duplicate window — two minutes by default — are treated as one. ' +
          'The window is a setting.',
      },
      {
        situation: 'An IN with no OUT',
        does:
          'The day is flagged as an exception rather than guessed at. Somebody adds the missing ' +
          'punch with a reason, and the day is rebuilt.',
      },
      {
        situation: 'A number that matches nobody',
        does:
          'The row is listed as an unknown number. It can be mapped to an employee, which creates ' +
          'an alias and is recorded, or ignored.',
      },
      {
        situation: 'Somebody works on a public holiday or their rest day',
        does: 'The day is flagged so that it can be confirmed as overtime or converted to rest.',
      },
      {
        situation: 'Somebody punches while on approved leave',
        does: 'Flagged for HR. The leave is not silently cancelled and the day is not silently paid.',
      },
      {
        situation: 'Somebody is absent with no leave request',
        does: 'Flagged. It becomes either a leave request entered on their behalf, or unpaid absence.',
      },
      {
        situation: 'The same period is imported twice',
        does:
          'Device punches for the period are replaced; manual corrections made in CPeople are kept. ' +
          'You are warned before anything is replaced.',
      },
      {
        situation: 'The file has a column we do not expect',
        does: 'It is ignored. Only the columns above are read.',
      },
    ];

    for (const row of rows) sheet.addRow(row);
    sheet.getColumn('does').alignment = { wrapText: true, vertical: 'top' };
  }
}

/** The one piece of styling every sheet shares. */
function header(sheet: ExcelJS.Worksheet): void {
  const row = sheet.getRow(1);

  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E7BB0' } };
  row.height = 20;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}
