import { Body, Controller, ForbiddenException, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { CurrentUserService } from '../../common/access/current-user.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  TenantSettingsService,
  type TenantSettings,
} from '../../common/settings/tenant-settings.service.js';

/** What an employee may see and do about their own file (HR-02 build spec §7.1). */
export class SelfServiceSettingsDto {
  @ApiPropertyOptional({ example: String.raw`^\d{1,10}$` })
  employeeNumberPattern?: string;

  @ApiPropertyOptional({ description: 'Whether an employee may see their own base salary' })
  employeesSeeSalary?: boolean;

  @ApiPropertyOptional({ description: 'Whether colleagues’ absences name the kind of leave' })
  showLeaveTypeToColleagues?: boolean;

  @ApiPropertyOptional({ description: 'Whether an employee may correct their own contact details' })
  employeesEditContact?: boolean;
}

/**
 * Self-service settings (HR-02 build spec §1 and §7.1).
 *
 * Read by anybody signed in — a screen has to know whether to offer the edit
 * button — and changed only by somebody who may manage settings. The one that
 * matters most is the salary switch: turning it off does not hide a figure, it
 * stops the API sending it.
 */
@ApiTags('Administration')
@ApiBearerAuth()
@Controller('settings/self-service')
export class SelfServiceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: CurrentUserService,
    private readonly settings: TenantSettingsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'What employees may see and do about their own file' })
  @ApiOkResponse({ type: SelfServiceSettingsDto })
  async read(): Promise<TenantSettings & { mayManage: boolean }> {
    const user = await this.users.withEmployee();

    return this.prisma.forTenant(user.tenantId, async (tx) => ({
      ...(await this.settings.read(tx)),
      mayManage: this.users.may(user, 'settings.templates.manage'),
    }));
  }

  @Patch()
  @ApiOperation({ summary: 'Change them. Audited, and in force on the next request.' })
  @ApiOkResponse({ type: SelfServiceSettingsDto })
  async update(@Body() body: SelfServiceSettingsDto): Promise<TenantSettings> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'settings.templates.manage')) {
      throw new ForbiddenException({ kind: 'notYours', values: {} });
    }

    return this.prisma.forTenant(user.tenantId, (tx) =>
      this.settings.update(tx, user, {
        ...(body.employeeNumberPattern === undefined
          ? {}
          : { employeeNumberPattern: body.employeeNumberPattern }),
        ...(body.employeesSeeSalary === undefined
          ? {}
          : { employeesSeeSalary: body.employeesSeeSalary }),
        ...(body.showLeaveTypeToColleagues === undefined
          ? {}
          : { showLeaveTypeToColleagues: body.showLeaveTypeToColleagues }),
        ...(body.employeesEditContact === undefined
          ? {}
          : { employeesEditContact: body.employeesEditContact }),
      }),
    );
  }
}
