import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ContractStatus, TenantClient } from '@cpeople/db';
import { addDays, daysUntil } from '@cpeople/shared';
import { CurrentUserService, type CurrentUser } from '../../common/access/current-user.service.js';
import { employeeScope, visibleEmployeeIds } from '../../common/access/visible-employees.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { PdfService } from '../../common/pdf/pdf.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { StorageService } from '../../common/storage/storage.service.js';
import { demoToday, plainDate } from '../../common/time/clock.js';
import type { UploadedFile } from '../employees/documents.service.js';
import {
  contractFileName,
  contractFooter,
  contractHtml,
  mergeFields,
  missingFields,
  type Clause,
} from './contract-document.js';
import type {
  ContractListDto,
  ContractPreviewDto,
  ContractRowDto,
  EndContractDto,
  RenewContractDto,
} from './dto/contract.dto.js';

/** The watermark on every page, and the note in every footer (spec 6.6). */
const WATERMARK = 'MODÈLE – DÉMONSTRATION';
const FOOTER_NOTE = 'Modèle de démonstration CPeople — texte à valider par SMG.';

/** Contracts that have not run their course. */
const RUNNING: ContractStatus[] = ['draft', 'generated', 'signed'];

/** How far ahead "ending soon" looks, as everywhere else. */
const SOON_DAYS = 30;

/**
 * Contracts: generating them, signing them, renewing them, ending them
 * (HR-01 spec 6.6).
 *
 * The document is produced from the template and its clauses, with the merge
 * fields filled in from the file — and what the file cannot answer is listed
 * before anything is printed, because a contract with a blank where the salary
 * should be is worse than one that was not generated.
 *
 * Nothing here is legal advice and the document says so on every page. Renewal
 * limits in particular are a question for SMG's HR: the screen says that too,
 * and this will renew whatever it is asked to.
 */
@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: CurrentUserService,
    private readonly audit: AuditService,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
  ) {}

  /** The list (6.6), over the files this person may see. */
  async list(query: {
    type?: string;
    status?: string;
    view?: string;
  }): Promise<ContractListDto> {
    const user = await this.users.withEmployee();
    const today = demoToday();

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const scope = employeeScope(await visibleEmployeeIds(tx, user));
      const status = RUNNING.includes(query.status as ContractStatus)
        ? [query.status as ContractStatus]
        : query.status === 'ended'
          ? (['ended', 'renewed'] as ContractStatus[])
          : RUNNING;

      const rows = await tx.contract.findMany({
        where: {
          employee: scope,
          status: { in: status },
          ...(query.type ? { contractType: { code: query.type } } : {}),
          ...(query.view === 'ending'
            ? {
                endDate: {
                  gte: date(today),
                  lte: date(addDays(today, SOON_DAYS)),
                },
              }
            : {}),
        },
        orderBy: [{ endDate: { sort: 'asc', nulls: 'last' } }, { startDate: 'desc' }],
        take: 200,
        include: {
          contractType: { select: { code: true, name: true } },
          employee: {
            select: { id: true, firstName: true, lastName: true, employeeNumber: true },
          },
        },
      });

      const types = await tx.contractType.findMany({
        orderBy: { name: 'asc' },
        select: { code: true, name: true },
      });

      return {
        rows: rows.map((row) => this.#row(row, today)),
        types,
        today,
        mayManage: this.users.may(user, 'contract.manage'),
      };
    });
  }

  /**
   * What the document would say, before it is printed (6.6, step 1).
   *
   * The merge data on one side and the text on the other, with anything the file
   * cannot answer named rather than quietly left blank.
   */
  async preview(id: string, clauseKeys?: readonly string[]): Promise<ContractPreviewDto> {
    const user = await this.users.withEmployee();
    const today = demoToday();

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const found = await this.#load(tx, user, id);
      const { source, template, clauses } = found;
      const fields = mergeFields(source);

      const chosen = clauses.filter(
        (clause) => clause.mandatory || clauseKeys === undefined || clauseKeys.includes(clause.key),
      );

      return {
        contract: this.#row(found.contract, today),
        title: template.title,
        fields: Object.entries(fields).map(([field, value]) => ({ field, value })),
        missing: missingFields(template.body, chosen, fields),
        clauses: clauses.map((clause) => ({
          key: clause.key,
          title: clause.title,
          mandatory: clause.mandatory,
          chosen: chosen.some((item) => item.key === clause.key),
          text: clause.text,
        })),
        fileName: contractFileName(
          found.contract.contractType.code,
          found.contract.employee.employeeNumber,
          today,
        ),
        mayManage: this.users.may(user, 'contract.manage'),
      };
    });
  }

  /**
   * Produces the PDF, stores it on the file, and marks the contract generated.
   *
   * The document is a document like any other once it exists: it goes to the
   * same store and appears on the Documents tab, because that is where somebody
   * looking for it will go.
   */
  async generate(id: string, clauseKeys?: readonly string[]): Promise<ContractPreviewDto> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'contract.manage')) {
      throw new ForbiddenException('Contracts are generated by HR.');
    }

    const today = demoToday();

    const { html, footer, fileName, employeeId, contractId, tenantId } =
      await this.prisma.forTenant(user.tenantId, async (tx) => {
        const found = await this.#load(tx, user, id);
        const { contract, template, clauses, source } = found;

        if (contract.status === 'ended' || contract.status === 'renewed') {
          throw new BadRequestException('This contract has run its course.');
        }

        const fields = mergeFields(source);
        const chosen = clauses.filter(
          (clause) =>
            clause.mandatory || clauseKeys === undefined || clauseKeys.includes(clause.key),
        );

        return {
          tenantId: user.tenantId,
          contractId: contract.id,
          employeeId: contract.employeeId,
          fileName: contractFileName(
            contract.contractType.code,
            contract.employee.employeeNumber,
            today,
          ),
          html: contractHtml({
            title: template.title,
            body: template.body,
            clauses: chosen,
            fields,
            watermark: WATERMARK,
            signatures: {
              employer: `Pour ${source.company.name}`,
              employee: source.employee.fullName,
            },
          }),
          footer: contractFooter(FOOTER_NOTE),
        };
      });

    // Outside the transaction: rendering and storing are slow, and neither of
    // them should hold a database connection while it happens.
    const pdf = await this.pdf.render({ html, footerHtml: footer });
    const stored = await this.storage.put({ tenantId, employeeId, fileName }, pdf, 'application/pdf');

    await this.prisma.forTenant(user.tenantId, async (tx) => {
      const type = await tx.documentType.findFirst({ where: { code: 'CONTRACT' } });

      const document = type
        ? await tx.employeeDocument.create({
            data: {
              tenantId,
              employeeId,
              documentTypeId: type.id,
              contractId,
              fileName,
              mimeType: 'application/pdf',
              byteSize: stored.byteSize,
              storageKey: stored.key,
              uploadedBy: user.name,
            },
          })
        : null;

      await tx.contract.update({
        where: { id: contractId },
        data: { status: 'generated', generatedAt: new Date() },
      });

      await this.audit.record(tx, user, {
        action: 'contract.generated',
        entity: 'employee',
        entityId: employeeId,
        summary: fileName,
        diff: [
          { field: 'contract', from: 'draft', to: 'generated' },
          ...(document ? [{ field: 'document', from: '', to: fileName }] : []),
        ],
      });
    });

    return this.preview(id, clauseKeys);
  }

  /**
   * Marks a contract signed, with the scan that proves it (6.6).
   *
   * The scan is filed as a document, the contract becomes signed, and the
   * onboarding item that was waiting for exactly this ticks itself — which is
   * the point of having tied the two together.
   */
  async sign(id: string, file: UploadedFile | undefined): Promise<ContractPreviewDto> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'contract.manage')) {
      throw new ForbiddenException('Contracts are managed by HR.');
    }

    if (!file) {
      throw new BadRequestException('No file was sent.');
    }

    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)) {
      throw new BadRequestException('A signed contract must be a PDF, a JPEG or a PNG.');
    }

    const employeeId = await this.prisma.forTenant(user.tenantId, async (tx) => {
      const found = await this.#load(tx, user, id);
      return found.contract.employeeId;
    });

    const stored = await this.storage.put(
      { tenantId: user.tenantId, employeeId, fileName: file.originalname },
      file.buffer,
      file.mimetype,
    );

    await this.prisma.forTenant(user.tenantId, async (tx) => {
      const type = await tx.documentType.findFirst({ where: { code: 'CONTRACT' } });

      if (type) {
        await tx.employeeDocument.create({
          data: {
            tenantId: user.tenantId,
            employeeId,
            documentTypeId: type.id,
            contractId: id,
            fileName: file.originalname.slice(-200),
            mimeType: file.mimetype,
            byteSize: stored.byteSize,
            storageKey: stored.key,
            uploadedBy: user.name,
            note: 'Signé',
          },
        });
      }

      await tx.contract.update({
        where: { id },
        data: { status: 'signed', signedAt: new Date() },
      });

      // The item that was waiting for this one thing.
      const waiting = await tx.onboardingTask.findFirst({
        where: {
          employeeId,
          status: 'todo',
          itemTemplate: { requiresDocumentTypeId: type?.id ?? undefined },
        },
      });

      if (waiting) {
        await tx.onboardingTask.update({
          where: { id: waiting.id },
          data: { status: 'done', doneAt: new Date(), doneBy: user.name },
        });
      }

      const employee = await tx.employee.findUniqueOrThrow({
        where: { id: employeeId },
        select: { firstName: true, lastName: true },
      });

      await this.audit.record(tx, user, {
        action: 'contract.signed',
        entity: 'employee',
        entityId: employeeId,
        summary: `${employee.firstName} ${employee.lastName}`,
        diff: [{ field: 'contract', from: 'generated', to: 'signed' }],
      });
    });

    return this.preview(id);
  }

  /**
   * Renews a fixed term: a new draft starting the day after the old one ends
   * (6.6).
   *
   * How many times a fixed term may be renewed is a question of Moroccan labour
   * law and of SMG's own practice, and neither belongs in this code. The screen
   * says so; this does what it is asked.
   */
  async renew(id: string, body: RenewContractDto): Promise<ContractPreviewDto> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'contract.manage')) {
      throw new ForbiddenException('Contracts are managed by HR.');
    }

    const endDate = plainOrThrow(body.endDate, 'end date');

    const renewed = await this.prisma.forTenant(user.tenantId, async (tx) => {
      const { contract } = await this.#load(tx, user, id);

      if (!contract.endDate) {
        throw new BadRequestException('A contract with no end date has nothing to renew.');
      }

      const startDate = addDays(plainDate(contract.endDate), 1);

      if (endDate <= startDate) {
        throw new BadRequestException('The new term has to end after it starts.');
      }

      const next = await tx.contract.create({
        data: {
          tenantId: user.tenantId,
          employeeId: contract.employeeId,
          contractTypeId: contract.contractTypeId,
          ...(contract.templateId ? { templateId: contract.templateId } : {}),
          status: 'draft',
          startDate: date(startDate),
          endDate: date(endDate),
          ...(contract.positionId ? { positionId: contract.positionId } : {}),
          ...(contract.workplaceSiteId ? { workplaceSiteId: contract.workplaceSiteId } : {}),
          salaryMinor: contract.salaryMinor,
          salaryCurrency: contract.salaryCurrency,
          previousContractId: contract.id,
        },
      });

      await tx.contract.update({ where: { id }, data: { status: 'renewed' } });

      await this.audit.record(tx, user, {
        action: 'contract.renewed',
        entity: 'employee',
        entityId: contract.employeeId,
        summary: `${contract.employee.firstName} ${contract.employee.lastName}`,
        diff: [
          { field: 'contract', from: plainDate(contract.endDate), to: endDate },
          { field: 'status', from: contract.status, to: 'renewed' },
        ],
      });

      return next.id;
    });

    return this.preview(renewed);
  }

  /**
   * Ends a contract, and with it the employment when nothing else is running.
   *
   * The reason is recorded because it is the first question anyone asks of an
   * ending, and because a demo that cannot answer it is not showing a contract
   * module.
   */
  async end(id: string, body: EndContractDto): Promise<ContractPreviewDto> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'contract.manage')) {
      throw new ForbiddenException('Contracts are managed by HR.');
    }

    const endDate = plainOrThrow(body.endDate, 'end date');
    const reason = (body.reason ?? '').trim().slice(0, 120) || 'other';

    await this.prisma.forTenant(user.tenantId, async (tx) => {
      const { contract } = await this.#load(tx, user, id);

      await tx.contract.update({
        where: { id },
        data: { status: 'ended', endDate: date(endDate), endReason: reason },
      });

      const stillRunning = await tx.contract.count({
        where: { employeeId: contract.employeeId, status: { in: RUNNING }, id: { not: id } },
      });

      if (stillRunning === 0) {
        await tx.employee.update({
          where: { id: contract.employeeId },
          data: { status: 'left', leftOn: date(endDate) },
        });
      }

      await this.audit.record(tx, user, {
        action: 'contract.ended',
        entity: 'employee',
        entityId: contract.employeeId,
        summary: `${contract.employee.firstName} ${contract.employee.lastName}`,
        diff: [
          { field: 'contract', from: contract.status, to: 'ended' },
          { field: 'endReason', from: '', to: reason },
          ...(stillRunning === 0 ? [{ field: 'status', from: 'active', to: 'left' }] : []),
        ],
      });
    });

    return this.preview(id);
  }

  /** One contract with everything the document needs, inside the reader's scope. */
  async #load(tx: TenantClient, user: CurrentUser, id: string) {
    const contract = await tx.contract.findUnique({
      where: { id },
      include: {
        contractType: { select: { code: true, name: true } },
        template: { include: { clauses: { orderBy: { sortOrder: 'asc' } } } },
        site: { select: { name: true, city: true } },
        employee: {
          include: {
            company: { select: { name: true } },
            position: { select: { title: true } },
            department: { select: { name: true } },
            site: { select: { name: true, city: true } },
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('No such contract.');
    }

    const ids = await visibleEmployeeIds(tx, user);

    if (ids !== 'all' && !ids.includes(contract.employeeId)) {
      throw new NotFoundException('No such contract.');
    }

    const template =
      contract.template ??
      (await tx.contractTemplate.findFirst({
        where: { contractTypeId: contract.contractTypeId },
        include: { clauses: { orderBy: { sortOrder: 'asc' } } },
      }));

    if (!template) {
      throw new BadRequestException('This kind of contract has no template yet.');
    }

    const clauses: Clause[] = ('clauses' in template ? template.clauses : []).map((clause) => ({
      key: clause.key,
      title: clause.title,
      text: clause.text,
      mandatory: clause.mandatory,
    }));

    return {
      contract,
      template,
      clauses,
      source: {
        company: {
          name: contract.employee.company.name,
          // A company is registered somewhere, but it is the workplace that a
          // contract names: "Fait à Casablanca" is where the work happens.
          city: contract.site?.city ?? contract.employee.site?.city ?? '',
        },
        employee: {
          fullName: `${contract.employee.firstName} ${contract.employee.lastName}`,
          nationalId: contract.employee.nationalId,
          birthDate: plainDate(contract.employee.birthDate),
          address: contract.employee.address ?? '',
          socialSecurityNumber: contract.employee.socialSecurityNumber ?? '',
          employeeNumber: contract.employee.employeeNumber,
        },
        position: { title: contract.employee.position.title },
        department: { name: contract.employee.department.name },
        site: { name: contract.site?.name ?? contract.employee.site?.name ?? '' },
        contract: {
          startDate: plainDate(contract.startDate),
          endDate: contract.endDate ? plainDate(contract.endDate) : '',
          trialEndDate: contract.trialEndDate ? plainDate(contract.trialEndDate) : '',
          salaryMinor: contract.salaryMinor,
        },
        today: demoToday(),
      },
    };
  }

  #row(
    contract: {
      id: string;
      status: string;
      startDate: Date;
      endDate: Date | null;
      trialEndDate: Date | null;
      endReason: string | null;
      generatedAt: Date | null;
      signedAt: Date | null;
      contractType: { code: string; name: string };
      employee: { id: string; firstName: string; lastName: string; employeeNumber: string };
    },
    today: string,
  ): ContractRowDto {
    const end = contract.endDate ? plainDate(contract.endDate) : undefined;

    return {
      id: contract.id,
      employee: {
        id: contract.employee.id,
        name: `${contract.employee.firstName} ${contract.employee.lastName}`,
        employeeNumber: contract.employee.employeeNumber,
      },
      type: contract.contractType,
      status: contract.status,
      startDate: plainDate(contract.startDate),
      ...(end ? { endDate: end, daysLeft: daysUntil(end, today) } : {}),
      ...(contract.trialEndDate ? { trialEndDate: plainDate(contract.trialEndDate) } : {}),
      ...(contract.endReason ? { endReason: contract.endReason } : {}),
      ...(contract.generatedAt ? { generatedAt: contract.generatedAt.toISOString() } : {}),
      ...(contract.signedAt ? { signedAt: contract.signedAt.toISOString() } : {}),
    };
  }
}

function plainOrThrow(value: string | undefined, what: string): string {
  const text = value?.trim() ?? '';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new BadRequestException(`A ${what} is required, as a date.`);
  }

  return text;
}

function date(plain: string): Date {
  return new Date(`${plain}T00:00:00Z`);
}
