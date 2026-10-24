import { Field, ID, ObjectType, registerEnumType } from "@nestjs/graphql";
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
