import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { CompanyDto } from './dto/company.dto.js';

@Injectable()
export class OrganisationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Companies of the current tenant. The policies, not this query, do the filtering. */
  async listCompanies(): Promise<CompanyDto[]> {
    const companies = await this.prisma.forCurrentTenant((tx) =>
      tx.company.findMany({ orderBy: { name: 'asc' } }),
    );

    return companies.map((company) => ({
      id: company.id,
      name: company.name,
      legalName: company.legalName,
      defaultCurrency: company.defaultCurrency,
    }));
  }
}
