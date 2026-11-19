import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import {
  createPrismaClient,
  withTenant,
  type CPeoplePrismaClient,
  type TenantClient,
} from '@cpeople/db';
import { TenantContextService } from '../tenant/tenant-context.service.js';

/**
 * Database access for the API.
 *
 * Everything that serves a request goes through forCurrentTenant(), which opens a
 * transaction as the unprivileged cpeople_app role with app.tenant_id set, so the
 * row-level-security policies decide what it can see (CLAUDE.md rule 1, M21).
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnApplicationShutdown {
  /**
   * The owner connection. It can read every tenant, so it is reserved for
   * provisioning, migration and platform jobs. Never use it to serve a request.
   */
  readonly owner: CPeoplePrismaClient = createPrismaClient();

  constructor(private readonly tenantContext: TenantContextService) {}

  async onModuleInit(): Promise<void> {
    await this.owner.$connect();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.owner.$disconnect();
  }

  /** Runs `fn` scoped to one tenant. */
  forTenant<T>(tenantId: string, fn: (tx: TenantClient) => Promise<T>): Promise<T> {
    return withTenant(this.owner, tenantId, fn);
  }

  /** Runs `fn` scoped to the tenant of the current request. */
  forCurrentTenant<T>(fn: (tx: TenantClient) => Promise<T>): Promise<T> {
    return this.forTenant(this.tenantContext.requireTenantId(), fn);
  }
}
