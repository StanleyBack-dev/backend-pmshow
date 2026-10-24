import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import webpush, { WebPushError } from "web-push";
import type {
  PushMessage,
  PushSenderPort,
  PushSubscriptionData,
} from "@/modules/notifications/application/ports/push.ports";

/** Push services drop messages not delivered within this time. */
const TTL_SECONDS = 24 * 60 * 60;

// Web Push with VAPID (works with Chrome/FCM, Firefox, Safari/iOS 16.4+
// installed PWAs). Without the keys, push is simply off.
@Injectable()
export class WebPushSender implements PushSenderPort {
  private readonly logger = new Logger(WebPushSender.name);
  private readonly key: string | null;
  private readonly details: webpush.VapidKeys & { subject: string };

  constructor(config: ConfigService) {
    const publicKey = config.get<string>("VAPID_PUBLIC_KEY") || "";
    const privateKey = config.get<string>("VAPID_PRIVATE_KEY") || "";
    const subject = config.get<string>("VAPID_SUBJECT") || "";
    this.details = { publicKey, privateKey, subject };
    this.key = publicKey && privateKey && subject ? publicKey : null;
    if (!this.key && (publicKey || privateKey)) {
      this.logger.warn(
        "Web Push desligado: defina VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT.",
      );
    }
  }

  publicKey(): string | null {
    return this.key;
  }

  async send(
    subscription: PushSubscriptionData,
    message: PushMessage,
  ): Promise<"sent" | "gone"> {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(message),
        {
          TTL: TTL_SECONDS,
          urgency: "normal",
          vapidDetails: this.details,
        },
      );
      return "sent";
    } catch (error) {
      // 404/410: the subscription no longer exists on the push service.
      if (
        error instanceof WebPushError &&
        (error.statusCode === 404 || error.statusCode === 410)
      ) {
        return "gone";
      }
      throw error;
    }
  }
}
