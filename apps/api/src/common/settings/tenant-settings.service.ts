import { Injectable } from '@nestjs/common';
import type { TenantClient } from '@cpeople/db';
import type { CurrentUser } from '../access/current-user.service.js';
import { AuditService } from '../audit/audit.service.js';

/**
 * The company's own settings, outside leave (HR-02 build spec §1 and §7.1).
 *
 * Three of them matter to more than one module, which is why they live here
 * rather than inside one:
 *
 *  - **whether an employee may see their own base salary** (HR-01 open point 2).
 *    Off by default, and when it is off the API does not send the figure at all.
 *    Hiding it on screen would leave it in the page for anybody who looked.
 *  - **what an employee number must look like**. Decision 2 of the HR-01
 *    minutes makes it the biometric device id and the format is still open, so
 *    this is a **warning only**: a number that does not match is flagged and
 *    still accepted. Refusing one would stop a hire over a question nobody has
 *    answered yet.
 *  - **whether colleagues' absences show which kind of leave they are**, which
 *    is a privacy decision and not a display one.
 *
 * A tenant with no row yet gets the defaults, so nothing has to be provisioned
 * before the application works.
 */
export interface TenantSettings {
  readonly employeeNumberPattern: string;
  readonly employeesSeeSalary: boolean;
  readonly showLeaveTypeToColleagues: boolean;
  readonly employeesEditContact: boolean;
}

export const DEFAULT_TENANT_SETTINGS: TenantSettings = {
  employeeNumberPattern: String.raw`^\d{1,10}$`,
  employeesSeeSalary: false,
  showLeaveTypeToColleagues: false,
  employeesEditContact: true,
};

@Injectable()
export class TenantSettingsService {
  constructor(private readonly audit: AuditService) {}

  async read(tx: TenantClient): Promise<TenantSettings> {
    const row = await tx.tenantSettings.findFirst();

    return row
      ? {
          employeeNumberPattern: row.employeeNumberPattern,
          employeesSeeSalary: row.employeesSeeSalary,
          showLeaveTypeToColleagues: row.showLeaveTypeToColleagues,
          employeesEditContact: row.employeesEditContact,
        }
      : DEFAULT_TENANT_SETTINGS;
  }

  /** Changes some of them, and records what changed. */
  async update(
    tx: TenantClient,
    user: CurrentUser,
    changes: Partial<TenantSettings>,
  ): Promise<TenantSettings> {
    const before = await this.read(tx);

    const next: TenantSettings = {
      employeeNumberPattern:
        changes.employeeNumberPattern?.trim() || before.employeeNumberPattern,
      employeesSeeSalary: changes.employeesSeeSalary ?? before.employeesSeeSalary,
      showLeaveTypeToColleagues:
        changes.showLeaveTypeToColleagues ?? before.showLeaveTypeToColleagues,
      employeesEditContact: changes.employeesEditContact ?? before.employeesEditContact,
    };

    await tx.tenantSettings.upsert({
      where: { tenantId: user.tenantId },
      create: { tenantId: user.tenantId, ...next },
      update: next,
    });

    const diff = (Object.keys(next) as (keyof TenantSettings)[])
      .filter((field) => String(before[field]) !== String(next[field]))
      .map((field) => ({ field, from: String(before[field]), to: String(next[field]) }));

    if (diff.length > 0) {
      await this.audit.record(tx, user, {
        action: 'settings.selfServiceUpdated',
        entity: 'tenantSettings',
        summary: 'Self-service settings',
        diff,
      });
    }

    return next;
  }

  /**
   * Whether this reader may be sent somebody's pay.
   *
   * The ordinary rule first — HR and administrators may, a manager may not —
   * and then the one case the setting governs: an employee reading their own
   * file. Everything else about a file they may already see.
   */
  maySeeSalary(
    user: CurrentUser,
    employeeId: string | undefined,
    settings: TenantSettings,
  ): boolean {
    if (this.#canByRole(user)) return true;

    const ownFile = employeeId !== undefined && employeeId === user.employeeId;
    return ownFile && settings.employeesSeeSalary;
  }

  #canByRole(user: CurrentUser): boolean {
    return user.capabilities.includes('employee.sensitive.read');
  }

  /**
   * Whether an employee number looks the way the company says it should.
   *
   * A bad pattern in the setting must not break hiring, so an unparseable
   * regular expression means "no opinion" rather than "everything is wrong".
   */
  checkEmployeeNumber(value: string, settings: TenantSettings): boolean {
    try {
      return new RegExp(settings.employeeNumberPattern).test(value);
    } catch {
      return true;
    }
  }
}
