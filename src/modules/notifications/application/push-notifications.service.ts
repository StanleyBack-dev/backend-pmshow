import { Inject, Injectable, Logger } from "@nestjs/common";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  PUSH_SENDER,
  PUSH_SUBSCRIPTION_REPOSITORY,
  type PushMessage,
  type PushSenderPort,
  type PushSubscriptionData,
  type PushSubscriptionRepositoryPort,
} from "@/modules/notifications/application/ports/push.ports";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import { redact } from "@/common/logging/redact";

const MAX_DEVICES_PER_USER = 10;

// Web Push channel: devices subscribe from the PWA; notifications go to all
// of a user's devices. Best effort: a failed push is logged, never retried
// (the in-app inbox and the e-mail already carry the same notice).
@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(
    @Inject(PUSH_SENDER) private readonly sender: PushSenderPort,
    @Inject(PUSH_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: PushSubscriptionRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  publicKey(): string | null {
    return this.sender.publicKey();
  }

  async subscribe(
    userId: string,
    subscription: PushSubscriptionData,
    userAgent: string | null,
  ): Promise<void> {
    if (!this.sender.publicKey()) {
      throw AppException.from(APP_ERRORS.notifications.pushDisabled, undefined);
    }
    const current = await this.subscriptions.listFor(userId);
    const known = current.some(
      (item) => item.endpoint === subscription.endpoint,
    );
    if (!known && current.length >= MAX_DEVICES_PER_USER) {
      throw AppException.from(
        APP_ERRORS.notifications.tooManyDevices,
        undefined,
      );
    }
    await this.subscriptions.save(userId, subscription, userAgent);
  }

  unsubscribe(userId: string, endpoint: string): Promise<boolean> {
    return this.subscriptions.remove(endpoint, userId);
  }

  /** Number of devices reached. */
  async sendTo(userId: string, message: PushMessage): Promise<number> {
    if (!this.sender.publicKey()) return 0;
    const devices = await this.subscriptions.listFor(userId);
    const results = await Promise.all(
      devices.map(async (device) => {
        try {
          const outcome = await this.sender.send(device, message);
          if (outcome === "gone") {
            await this.subscriptions.remove(device.endpoint);
            return false;
          }
          await this.subscriptions.touch(device.endpoint, this.clock.now());
          return true;
        } catch (error) {
          this.logger.warn(`Push não entregue: ${redact(String(error))}`);
          return false;
        }
      }),
    );
    return results.filter(Boolean).length;
  }
}
