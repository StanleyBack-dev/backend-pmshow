import { Field, ObjectType, registerEnumType } from "@nestjs/graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import { UserGroup } from "@/modules/access-control/domain/user-group";

registerEnumType(Permission, {
  name: "Permission",
  description: "Capacidade verificada pela API.",
});

registerEnumType(UserGroup, {
  name: "UserGroup",
  description: "Perfil de acesso: Músico, Gestor ou Administrador geral.",
  valuesMap: {
    USER: { description: "Músico" },
    ADMIN: { description: "Gestor" },
    ADMIN_MASTER: { description: "Administrador geral" },
  },
});

@ObjectType("PermissionOverride")
export class PermissionOverrideType {
  @Field(() => Permission)
  permission!: Permission;

  @Field()
  allowed!: boolean;
}

@ObjectType("PermissionMatrix")
export class PermissionMatrixType {
  @Field(() => [Permission], {
    description: "O que o usuário pode fazer (padrão do grupo + exceções).",
  })
  effective!: Permission[];

  @Field(() => [Permission], { description: "O que o grupo concede." })
  defaults!: Permission[];

  @Field(() => [PermissionOverrideType], {
    description: "Exceções do usuário em relação ao grupo.",
  })
  overrides!: PermissionOverrideType[];
}
