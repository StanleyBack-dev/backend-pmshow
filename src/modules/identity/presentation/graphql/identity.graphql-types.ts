import { Field, ID, InputType, ObjectType } from "@nestjs/graphql";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from "class-validator";
import { Paginated } from "@/common/graphql/pagination.graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import { UserGroup } from "@/modules/access-control/domain/user-group";
// Registers the Permission/UserGroup enums and the PermissionMatrix type.
import "@/modules/access-control/presentation/graphql/access-control.graphql-types";

// === outputs ===

@ObjectType("SessionUser", { description: "Usuário da sessão atual." })
export class SessionUserType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  username!: string;

  @Field()
  email!: string;

  @Field(() => UserGroup)
  group!: UserGroup;

  @Field({
    description: "Precisa trocar a senha temporária antes de usar o app.",
  })
  mustChangePassword!: boolean;

  @Field(() => [Permission], { description: "Permissões efetivas." })
  permissions!: Permission[];
}

@ObjectType("AuthTokens")
export class AuthTokensType {
  @Field()
  accessToken!: string;

  @Field()
  accessTokenExpiresAt!: Date;

  @Field()
  refreshToken!: string;

  @Field()
  refreshTokenExpiresAt!: Date;
}

@ObjectType("LoginResult")
export class LoginResultType extends AuthTokensType {
  @Field(() => SessionUserType)
  user!: SessionUserType;
}

@ObjectType("UserAccount", { description: "Usuário visto pela administração." })
export class UserAccountType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  email!: string;

  @Field()
  username!: string;

  @Field(() => UserGroup)
  group!: UserGroup;

  @Field()
  active!: boolean;

  @Field({ description: "Ainda não trocou a senha temporária." })
  mustChangePassword!: boolean;

  @Field(() => Date, {
    nullable: true,
    description: "Bloqueado por tentativas inválidas até esta data.",
  })
  lockedUntil!: Date | null;

  @Field(() => Date, { nullable: true })
  lastLoginAt!: Date | null;

  @Field(() => Date, { nullable: true })
  deactivatedAt!: Date | null;

  @Field()
  createdAt!: Date;
}

export const UserAccountPage = Paginated(UserAccountType, "UserAccountPage");

@ObjectType("TemporaryAccess", {
  description: "Senha temporária, exibida uma única vez para quem a gerou.",
})
export class TemporaryAccessType {
  @Field(() => UserAccountType)
  user!: UserAccountType;

  @Field()
  temporaryPassword!: string;

  @Field({ description: "Se o e-mail com o acesso foi enviado." })
  emailSent!: boolean;
}

// === inputs ===

@InputType()
export class LoginInput {
  @Field({ description: "Usuário ou e-mail." })
  @IsString()
  @Length(1, 254)
  login!: string;

  @Field()
  @IsString()
  @Length(1, 128)
  password!: string;
}

@InputType()
export class ChangePasswordInput {
  @Field()
  @IsString()
  @Length(1, 128)
  currentPassword!: string;

  @Field()
  @IsString()
  @Length(1, 128)
  newPassword!: string;
}

@InputType()
export class UpdateMyProfileInput {
  @Field()
  @IsString()
  @Length(2, 120)
  name!: string;

  @Field()
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

@InputType()
export class VerifyRecoveryCodeInput {
  @Field()
  @IsString()
  @Length(1, 254)
  login!: string;

  @Field()
  @IsString()
  @Length(4, 12)
  code!: string;
}

@InputType()
export class ResetPasswordInput {
  @Field()
  @IsString()
  @Length(16, 256)
  resetToken!: string;

  @Field()
  @IsString()
  @Length(1, 128)
  newPassword!: string;
}

@InputType()
export class CreateUserInput {
  @Field()
  @IsString()
  @Length(2, 120)
  name!: string;

  @Field()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Field({ description: "Login: 3 a 32 caracteres (a-z, 0-9, ., -, _)." })
  @IsString()
  @Length(3, 32)
  username!: string;

  @Field(() => UserGroup)
  @IsEnum(UserGroup)
  group!: UserGroup;
}

@InputType()
export class UpdateUserInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(3, 32)
  username?: string;

  @Field(() => UserGroup, { nullable: true })
  @IsOptional()
  @IsEnum(UserGroup)
  group?: UserGroup;
}

@InputType()
export class UserFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @Field(() => UserGroup, { nullable: true })
  @IsOptional()
  @IsEnum(UserGroup)
  group?: UserGroup;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

@InputType()
export class SetUserPermissionsInput {
  @Field(() => ID)
  @IsUUID()
  userId!: string;

  @Field({
    description: "true descarta as exceções e volta ao padrão do grupo.",
  })
  @IsBoolean()
  useGroupDefaults!: boolean;

  @Field(() => [Permission], {
    nullable: true,
    description: "Conjunto completo desejado (ignorado com useGroupDefaults).",
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(Permission, { each: true })
  permissions?: Permission[];
}
