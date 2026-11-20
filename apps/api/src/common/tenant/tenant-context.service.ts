import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { Principal } from '../auth/token-verifier.service.js';

export interface TenantContext {
  /** Tenant of the signed-in user, taken from the verified session. */
  readonly tenantId: string;
  /**
   * Who is signed in, when a real token said so. Absent for the local-development
   * header path, which identifies a tenant but nobody in particular.
   */
  readonly principal?: Principal;
}

/**
 * Carries the tenant of the current request through the call stack, so a service
 * never has to pass a tenant id down by hand and can never be called without one
 * (CLAUDE.md rule 1).
 */
@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContext>();

  run<T>(context: TenantContext, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  get current(): TenantContext | undefined {
    return this.storage.getStore();
  }

  /** The current tenant, or a failure: no request code may run without one. */
  requireTenantId(): string {
    const context = this.storage.getStore();
    if (!context) {
      throw new InternalServerErrorException('No tenant context for this request');
    }
    return context.tenantId;
  }

  /** The signed-in user, or a failure if this request was not authenticated. */
  requirePrincipal(): Principal {
    const principal = this.storage.getStore()?.principal;
    if (!principal) {
      throw new InternalServerErrorException('This request has no signed-in user');
    }
    return principal;
  }
}
