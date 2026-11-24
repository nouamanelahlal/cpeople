import { Body, Controller, ForbiddenException, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUserService } from '../../common/access/current-user.service.js';
import { employeeScope, visibleEmployeeIds } from '../../common/access/visible-employees.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { demoToday } from '../../common/time/clock.js';
import {
  AdjustBalanceDto,
  BalanceHistoryDto,
  BalanceListDto,
  BalanceStatementDto,
  CarryOverResultDto,
  ImportReportDto,
  PeriodAbsencesDto,
} from './dto/leave-balance.dto.js';
import { AbsencesForPayrollService } from './absences-for-payroll.service.js';
import { LeaveBalanceService } from './leave-balance.service.js';
import { LeaveCarryOverService } from './leave-carry-over.service.js';
import { LeaveImportService } from './leave-import.service.js';

/**
 * Balances (M09 / HR-04).
 *
 * Who sees whose is decided here and nowhere else: HR and administrators see
 * everyone, a manager sees their own branch of the organisation, and anybody
 * else sees their own. It is the same scope the employee list uses, deliberately
 * — a manager who can see a person's file can see that person's balance, and a
 * manager who cannot, cannot.
 */
@ApiTags('Time & absence')
@ApiBearerAuth()
@Controller('leave/balances')
export class LeaveBalanceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: CurrentUserService,
    private readonly balances: LeaveBalanceService,
    private readonly imports: LeaveImportService,
    private readonly carryOver: LeaveCarryOverService,
    private readonly absences: AbsencesForPayrollService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Balances for everyone this reader may see' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'department', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({ type: BalanceListDto })
  async list(
    @Query('q') q?: string,
    @Query('department') department?: string,
    @Query('limit') limit?: string,
  ): Promise<BalanceListDto> {
    const user = await this.users.withEmployee();
    const take = Math.min(Math.max(Number.parseInt(limit ?? '50', 10) || 50, 1), 500);

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const visible = await visibleEmployeeIds(tx, user);
      const search = q?.trim() ?? '';

      const where = {
        ...employeeScope(visible),
        status: { in: ['active' as const, 'onboarding' as const] },
        ...(department ? { department: { code: department } } : {}),
        ...(search === ''
          ? {}
          : {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' as const } },
                { lastName: { contains: search, mode: 'insensitive' as const } },
                { employeeNumber: { contains: search, mode: 'insensitive' as const } },
              ],
            }),
      };

      const [people, total, types] = await Promise.all([
        tx.employee.findMany({
          where,
          select: { id: true },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          take,
        }),
        tx.employee.count({ where }),
        tx.leaveType.findMany({
          where: { tracksBalance: true, active: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, code: true, name: true },
        }),
      ]);

      const employees = [];
      for (const person of people) {
        employees.push(await this.balances.statement(tx, { employeeId: person.id }));
      }

      return {
        employees,
        types,
        total,
        mayManage: this.users.may(user, 'leave.manage.all'),
        today: demoToday(),
      };
    });
  }

  @Get('me')
  @ApiOperation({ summary: 'The reader’s own balances' })
  @ApiOkResponse({ type: BalanceStatementDto })
  async mine(): Promise<BalanceStatementDto> {
    const user = await this.users.withEmployee();

    if (!user.employeeId) {
      throw new ForbiddenException({ kind: 'noEmployee', values: {} });
    }

    return this.prisma.forTenant(user.tenantId, (tx) =>
      this.balances.statement(tx, { employeeId: user.employeeId as string }),
    );
  }

  @Get('employee/:id')
  @ApiOperation({ summary: 'One person’s balances, if this reader may see them' })
  @ApiOkResponse({ type: BalanceStatementDto })
  async forEmployee(@Param('id') id: string): Promise<BalanceStatementDto> {
    const user = await this.users.withEmployee();

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      await this.#mustSee(tx, id);
      return this.balances.statement(tx, { employeeId: id });
    });
  }

  @Get('employee/:id/history')
  @ApiOperation({ summary: 'Everything that has moved one person’s balance' })
  @ApiOkResponse({ type: [BalanceHistoryDto] })
  async history(@Param('id') id: string): Promise<BalanceHistoryDto[]> {
    const user = await this.users.withEmployee();

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      await this.#mustSee(tx, id);
      return this.balances.history(tx, { employeeId: id });
    });
  }

  @Post('adjust')
  @ApiOperation({ summary: 'HR moving a balance by hand, with a reason' })
  async adjust(@Body() body: AdjustBalanceDto): Promise<{ id: string }> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'leave.manage.all')) {
      throw new ForbiddenException({ kind: 'notYours', values: {} });
    }

    return this.prisma.forTenant(user.tenantId, (tx) =>
      this.balances.adjust(tx, user, {
        employeeId: body.employeeId,
        leaveTypeId: body.leaveTypeId,
        days: Number(body.days),
        reason: body.reason,
        ...(body.effectiveOn ? { effectiveOn: body.effectiveOn } : {}),
      }),
    );
  }

  @Get('import/template')
  @ApiOperation({ summary: 'The opening-balance template, as CSV inside JSON' })
  async template(): Promise<{ content: string; filename: string }> {
    // As JSON rather than as a body of text: every other route here answers
    // JSON, and the web app turns this into a file to download.
    return {
      content: await this.imports.template(),
      filename: 'cpeople-opening-balances.csv',
    };
  }

  @Post('import/trial')
  @ApiOperation({ summary: 'Reads a file and says what is wrong with it. Writes nothing.' })
  @ApiOkResponse({ type: ImportReportDto })
  trial(@Body() body: { content?: string }): Promise<ImportReportDto> {
    return this.imports.trial(body.content ?? '');
  }

  @Post('import/confirm')
  @ApiOperation({ summary: 'Writes the whole file, or none of it' })
  @ApiOkResponse({ type: ImportReportDto })
  confirm(@Body() body: { content?: string }): Promise<ImportReportDto> {
    return this.imports.confirm(body.content ?? '');
  }

  @Get('carry-over')
  @ApiOperation({ summary: 'The year-end runs so far' })
  runs(): Promise<unknown> {
    return this.carryOver.runs();
  }

  @Post('carry-over/preview')
  @ApiOperation({ summary: 'What year-end would carry. Touches no balance.' })
  @ApiOkResponse({ type: CarryOverResultDto })
  preview(@Body() body: { year?: number }): Promise<CarryOverResultDto> {
    return this.carryOver.preview(Number(body.year)) as Promise<CarryOverResultDto>;
  }

  @Post('carry-over/apply')
  @ApiOperation({ summary: 'Runs year-end. Safe to run again.' })
  @ApiOkResponse({ type: CarryOverResultDto })
  apply(@Body() body: { year?: number }): Promise<CarryOverResultDto> {
    return this.carryOver.apply(Number(body.year)) as Promise<CarryOverResultDto>;
  }

  /**
   * What a payroll month is told about absence (M09 → M10).
   *
   * Approved days only, split by the month they fall in, with the corrections
   * carried from any closed month. **No pay is calculated here** — that is the
   * payroll engine's work, and the country pack's.
   */
  @Get('payroll/:period')
  @ApiOperation({ summary: 'Approved absence in one payroll month, ready for payroll' })
  @ApiOkResponse({ type: PeriodAbsencesDto })
  async forPayroll(@Param('period') period: string): Promise<PeriodAbsencesDto> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'leave.manage.all')) {
      throw new ForbiddenException({ kind: 'notYours', values: {} });
    }

    return this.absences.forPeriod(user.tenantId, period) as Promise<PeriodAbsencesDto>;
  }

  /** Refuses a person this reader may not see, rather than answering about them. */
  async #mustSee(tx: Parameters<typeof visibleEmployeeIds>[0], id: string): Promise<void> {
    const user = await this.users.withEmployee();
    const visible = await visibleEmployeeIds(tx, user);

    if (visible !== 'all' && !visible.includes(id)) {
      throw new ForbiddenException({ kind: 'notYours', values: {} });
    }
  }
}
