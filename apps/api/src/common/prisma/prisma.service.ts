import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { createPrismaClient, withTenant, type TenantClient } from '@cpeople/db';
import { TenantContextService } from '../tenant/tenant-context.service.js';

/**
 * Database access for the API.
 *
 * Two things keep a request inside its own tenant, and they are independent:
 *
 *  - the pool connects as cpeople_app, which owns no table and holds only the grants
 *    it needs, so the row-level-security policies apply to everything it runs. A
 *    query that skips the tenant context therefore returns nothing, rather than
 *    every tenant's rows;
 *  - forCurrentTenant() opens a transaction with that tenant set, which is what
 *    makes the policies select the right rows.
 *
 * The client itself is private: forTenant() and forCurrentTenant() are the only ways
 * to reach the database from here (CLAUDE.md rule 1, M21). There is no owner
 * connection in the API at all — migrations and tenant provisioning are
 * command-line work, on their own connection.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnApplicationShutdown {
  readonly #client = createPrismaClient();

  constructor(private readonly tenantContext: TenantContextService) {}

  async onModuleInit(): Promise<void> {
    await this.#client.$connect();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.#client.$disconnect();
  }

  /** Runs `fn` scoped to one tenant. */
  forTenant<T>(tenantId: string, fn: (tx: TenantClient) => Promise<T>): Promise<T> {
    return withTenant(this.#client, tenantId, fn);
  }

  /** Runs `fn` scoped to the tenant of the current request. */
  forCurrentTenant<T>(fn: (tx: TenantClient) => Promise<T>): Promise<T> {
    return this.forTenant(this.tenantContext.requireTenantId(), fn);
  }
}
