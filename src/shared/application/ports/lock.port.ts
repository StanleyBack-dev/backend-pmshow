// Distributed mutual exclusion between concurrent serverless invocations.
// Lease-based, so a crashed invocation never holds the lock forever.
export interface LockPort {
  tryAcquire(name: string, holder: string, leaseMs: number): Promise<boolean>;
  release(name: string, holder: string): Promise<void>;
}

export const LOCK = Symbol("LOCK");
