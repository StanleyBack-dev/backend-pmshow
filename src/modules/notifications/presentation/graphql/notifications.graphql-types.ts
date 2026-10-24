import {
  Field,
  ID,
  InputType,
  ObjectType,
  registerEnumType,
} from "@nestjs/graphql";
import { IsString, IsUrl, Length, MaxLength } from "class-validator";
import { Paginated } from "@/common/graphql/pagination.graphql";
import { NotificationType } from "@/modules/notifications/domain/notification";

registerEnumType(NotificationType, { name: "NotificationType" });

@ObjectType("Notification")
export class NotificationGqlType {
  @Field(() => ID)
  id!: string;

  @Field(() => NotificationType)
  type!: NotificationType;

  @Field()
  title!: string;

  @Field()
  body!: string;

  @Field(() => String, { nullable: true, description: "Caminho no app." })
  link!: string | null;

  @Field(() => Date, { nullable: true })
  readAt!: Date | null;

  @Field()
  createdAt!: Date;
}

export const NotificationPage = Paginated(
  NotificationGqlType,
  "NotificationPage",
);

@ObjectType("NotificationPreference")
export class NotificationPreferenceType {
  @Field(() => NotificationType)
  type!: NotificationType;

  @Field({ description: "Também recebe por e-mail." })
  emailEnabled!: boolean;
}

@InputType({ description: "PushSubscription do navegador (PushManager)." })
export class PushSubscriptionInput {
  @Field()
  @IsUrl({ protocols: ["https"], require_tld: false })
  @MaxLength(1000)
  endpoint!: string;

  @Field({ description: "Chave pública do aparelho (base64url)." })
  @IsString()
  @Length(20, 200)
  p256dh!: string;

  @Field({ description: "Segredo de autenticação (base64url)." })
  @IsString()
  @Length(8, 100)
  auth!: string;
}
