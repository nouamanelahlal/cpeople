import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { TenantClient } from '@cpeople/db';
import { daysUntil, documentState } from '@cpeople/shared';
import { CurrentUserService, type CurrentUser } from '../../common/access/current-user.service.js';
import { visibleEmployeeIds } from '../../common/access/visible-employees.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { StorageService, type FileContent } from '../../common/storage/storage.service.js';
import { demoToday, plainDate } from '../../common/time/clock.js';
import type {
  EmployeeDocumentDto,
  EmployeeDocumentsDto,
  UploadDocumentDto,
} from './dto/document.dto.js';

/** What may be uploaded, and how much of it (HR-01 spec 6.7). */
export const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const MAX_BYTES = 10 * 1024 * 1024;

/** A file as the framework hands it over, named here so nothing imports multer. */
export interface UploadedFile {
  readonly originalname: string;
  readonly mimetype: string;
  readonly size: number;
  readonly buffer: Buffer;
}

/**
 * The documents on an employee's file (HR-01 spec 6.7).
 *
 * The rule for when a document is running out lives in `@cpeople/shared`, so the
 * pill here, the dot on the list, the figure on the home screen and the filter
 * behind it are the same rule and cannot drift apart.
 *
 * Some kinds of document are private in themselves — a copy of someone's
 * identity card is their identity card — so the bytes of a sensitive type are
 * only handed to a reader who may see that person's private fields. The row is
 * still listed: a manager may know a medical certificate is on file and when it
 * runs out without being able to open it.
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: CurrentUserService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async list(employeeId: string): Promise<EmployeeDocumentsDto> {
    const user = await this.users.withEmployee();
    const today = demoToday();

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      await this.#mustSee(tx, user, employeeId);
      const seeSensitive = this.users.maySeeSensitive(user, employeeId);
      const mayUpload = this.users.may(user, 'document.upload');

      const [rows, types] = await Promise.all([
        tx.employeeDocument.findMany({
          where: { employeeId },
          orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
          include: { documentType: true },
        }),
        tx.documentType.findMany({ orderBy: { name: 'asc' } }),
      ]);

      return {
        documents: rows.map((row) => this.#view(row, today, { seeSensitive, mayUpload })),
        types: types.map((type) => ({
          code: type.code,
          name: type.name,
          requiresExpiry: type.requiresExpiry,
          alertDaysBefore: type.alertDaysBefore,
          sensitive: type.sensitive,
        })),
        today,
        mayUpload,
      };
    });
  }

  /**
   * Adds a document to a file.
   *
   * The bytes go to the object store and the row to the database, in that order:
   * a row pointing at nothing would be a document that cannot be opened, while an
   * object nobody points at is only wasted space.
   */
  async upload(
    employeeId: string,
    body: UploadDocumentDto,
    file: UploadedFile | undefined,
  ): Promise<EmployeeDocumentDto> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'document.upload')) {
      throw new ForbiddenException('Documents are added by HR.');
    }

    if (!file) {
      throw new BadRequestException('No file was sent.');
    }

    if (!(ALLOWED_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new BadRequestException('A document must be a PDF, a JPEG or a PNG.');
    }

    if (file.size > MAX_BYTES) {
      throw new BadRequestException('A document must be 10 MB or smaller.');
    }

    const today = demoToday();

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      await this.#mustSee(tx, user, employeeId);

      const type = await tx.documentType.findFirst({ where: { code: body.type } });
      if (!type) {
        throw new BadRequestException('That is not a kind of document this company keeps.');
      }

      const expiryDate = plainOrNull(body.expiryDate);
      if (type.requiresExpiry && expiryDate === null) {
        throw new BadRequestException(`${type.name} needs an expiry date.`);
      }

      const stored = await this.storage.put(
        { tenantId: user.tenantId, employeeId, fileName: file.originalname },
        file.buffer,
        file.mimetype,
      );

      const row = await tx.employeeDocument.create({
        data: {
          tenantId: user.tenantId,
          employeeId,
          documentTypeId: type.id,
          fileName: file.originalname.slice(-200),
          mimeType: file.mimetype,
          byteSize: stored.byteSize,
          storageKey: stored.key,
          ...(plainOrNull(body.issueDate) ? { issueDate: date(body.issueDate!) } : {}),
          ...(expiryDate ? { expiryDate: date(expiryDate) } : {}),
          uploadedBy: user.name,
          ...(body.note?.trim() ? { note: body.note.trim().slice(0, 240) } : {}),
        },
        include: { documentType: true, employee: { select: { firstName: true, lastName: true } } },
      });

      await this.audit.record(tx, user, {
        action: 'document.uploaded',
        entity: 'employee',
        entityId: employeeId,
        summary: `${row.employee.firstName} ${row.employee.lastName}`,
        diff: [{ field: 'document', from: '', to: `${type.name} — ${row.fileName}` }],
      });

      return this.#view(row, today, { seeSensitive: true, mayUpload: true });
    });
  }

  /** The bytes, for a reader allowed both the file and this kind of document. */
  async content(documentId: string): Promise<FileContent & { fileName: string }> {
    const user = await this.users.withEmployee();

    const row = await this.prisma.forTenant(user.tenantId, async (tx) => {
      const found = await tx.employeeDocument.findUnique({
        where: { id: documentId },
        include: { documentType: true },
      });

      if (!found) {
        throw new NotFoundException('No such document.');
      }

      await this.#mustSee(tx, user, found.employeeId);

      if (found.documentType.sensitive && !this.users.maySeeSensitive(user, found.employeeId)) {
        // Listed, but not opened: a copy of someone's identity card is their
        // identity card.
        throw new NotFoundException('No such document.');
      }

      return found;
    });

    if (!row.storageKey) {
      // Seeded rows stand for paperwork that exists in a filing cabinet; nothing
      // was ever uploaded for them.
      throw new NotFoundException('This document has no file attached.');
    }

    const content = await this.storage.get(row.storageKey);
    return { ...content, fileName: row.fileName };
  }

  /** Takes a document off a file, and says so in the trail. */
  async remove(documentId: string): Promise<void> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'document.upload')) {
      throw new ForbiddenException('Documents are managed by HR.');
    }

    const key = await this.prisma.forTenant(user.tenantId, async (tx) => {
      const row = await tx.employeeDocument.findUnique({
        where: { id: documentId },
        include: { documentType: true, employee: { select: { firstName: true, lastName: true } } },
      });

      if (!row) {
        throw new NotFoundException('No such document.');
      }

      await this.#mustSee(tx, user, row.employeeId);
      await tx.employeeDocument.delete({ where: { id: documentId } });
      await this.audit.record(tx, user, {
        action: 'document.deleted',
        entity: 'employee',
        entityId: row.employeeId,
        summary: `${row.employee.firstName} ${row.employee.lastName}`,
        diff: [{ field: 'document', from: `${row.documentType.name} — ${row.fileName}`, to: '' }],
      });

      return row.storageKey;
    });

    if (key) {
      // After the row, and never the other way round: a file with no row is
      // rubbish, a row with no file is a broken link on a screen.
      await this.storage.remove(key).catch(() => undefined);
    }
  }

  #view(
    row: {
      id: string;
      fileName: string;
      mimeType: string;
      byteSize: number;
      issueDate: Date | null;
      expiryDate: Date | null;
      uploadedBy: string | null;
      note: string | null;
      createdAt: Date;
      storageKey: string | null;
      documentType: {
        code: string;
        name: string;
        requiresExpiry: boolean;
        alertDaysBefore: number;
        sensitive: boolean;
      };
    },
    today: string,
    reader: { seeSensitive: boolean; mayUpload: boolean },
  ): EmployeeDocumentDto {
    const expiry = row.expiryDate ? plainDate(row.expiryDate) : undefined;

    return {
      id: row.id,
      type: {
        code: row.documentType.code,
        name: row.documentType.name,
        requiresExpiry: row.documentType.requiresExpiry,
        alertDaysBefore: row.documentType.alertDaysBefore,
        sensitive: row.documentType.sensitive,
      },
      fileName: row.fileName,
      mimeType: row.mimeType,
      byteSize: row.byteSize,
      ...(row.issueDate ? { issueDate: plainDate(row.issueDate) } : {}),
      ...(expiry ? { expiryDate: expiry } : {}),
      state: documentState(expiry, today, row.documentType.alertDaysBefore),
      ...(expiry ? { daysLeft: daysUntil(expiry, today) } : {}),
      ...(row.uploadedBy ? { uploadedBy: row.uploadedBy } : {}),
      uploadedAt: row.createdAt.toISOString(),
      ...(row.note ? { note: row.note } : {}),
      mayOpen:
        row.storageKey !== null && (!row.documentType.sensitive || reader.seeSensitive),
      mayDelete: reader.mayUpload,
    };
  }

  /** A file outside this reader's scope is not found; see the file service. */
  async #mustSee(tx: TenantClient, user: CurrentUser, employeeId: string): Promise<void> {
    const ids = await visibleEmployeeIds(tx, user);

    if (ids !== 'all' && !ids.includes(employeeId)) {
      throw new NotFoundException('No such employee file.');
    }
  }
}

function plainOrNull(value: string | undefined): string | null {
  const text = value?.trim();
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function date(plain: string): Date {
  return new Date(`${plain}T00:00:00Z`);
}
