import { ParseUUIDPipe } from "@nestjs/common";
import {
  Args,
  ID,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Public } from "@/common/decorators/public.decorator";
import {
  CurrentRequestMeta,
  type RequestMeta,
} from "@/common/decorators/request-meta.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import {
  EnrollmentInvitesUseCase,
  EnrollmentReviewUseCase,
  PublicEnrollmentUseCase,
  type EnrollmentApproval,
} from "@/modules/enrollment/application/enrollment.use-cases";
import type {
  EnrollmentInvite,
  EnrollmentRequest,
} from "@/modules/enrollment/domain/enrollment";
import {
  CreateEnrollmentInviteInput,
  EnrollmentApprovalType,
  EnrollmentDataInput,
  EnrollmentInstrumentType,
  EnrollmentInviteType,
  EnrollmentRequestFilterInput,
  EnrollmentRequestPage,
  EnrollmentRequestType,
  SubmitEnrollmentInput,
} from "@/modules/enrollment/presentation/graphql/enrollment.graphql-types";
import type { Paginated } from "@/shared/application/pagination";

const Id = () => new ParseUUIDPipe({ version: "4" });

// Public side: the code opens the form, the form becomes a pending request.
@Resolver()
export class PublicEnrollmentResolver {
  constructor(private readonly enrollment: PublicEnrollmentUseCase) {}

  @Public()
  @Mutation(() => String, {
    description:
      "Confere o código da turma e devolve o token do formulário (vale 60 min).",
  })
  verifyEnrollmentCode(
    @Args("code") code: string,
    @CurrentRequestMeta() meta: RequestMeta,
  ): Promise<string> {
    return this.enrollment.verify(code.slice(0, 12), meta.ipAddress);
  }

  @Public()
  @Query(() => [EnrollmentInstrumentType])
  enrollmentInstruments(
    @Args("formToken") formToken: string,
  ): Promise<EnrollmentInstrumentType[]> {
    return this.enrollment.instrumentOptions(formToken.slice(0, 300));
  }

  @Public()
  @Mutation(() => Boolean, {
    description: "Envia o cadastro, que aguarda a aprovação da administração.",
  })
  async submitEnrollment(
    @Args("input") input: SubmitEnrollmentInput,
    @CurrentRequestMeta() meta: RequestMeta,
  ): Promise<boolean> {
    await this.enrollment.submit(
      input.formToken,
      input.data,
      input.consent,
      meta.ipAddress,
      input.photo,
    );
    return true;
  }
}

// Manager side: invites of the cohort and review of the requests. Approving
// creates an account, so it needs both users and members management.
@Resolver()
export class EnrollmentAdminResolver {
  constructor(
    private readonly invites: EnrollmentInvitesUseCase,
    private readonly review: EnrollmentReviewUseCase,
  ) {}

  @RequirePermissions(Permission.USERS_MANAGE)
  @Query(() => [EnrollmentInviteType])
  enrollmentInvites(): Promise<EnrollmentInvite[]> {
    return this.invites.list();
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Mutation(() => EnrollmentInviteType)
  createEnrollmentInvite(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: CreateEnrollmentInviteInput,
  ): Promise<EnrollmentInvite> {
    return this.invites.create(actor, input);
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Mutation(() => EnrollmentInviteType)
  revokeEnrollmentInvite(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
  ): Promise<EnrollmentInvite> {
    return this.invites.revoke(actor, id);
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Query(() => EnrollmentRequestPage)
  enrollmentRequests(
    @Args("filter", { nullable: true }) filter?: EnrollmentRequestFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<EnrollmentRequest>> {
    return this.review.list(filter ?? {}, page ?? { page: 1, limit: 10 });
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Query(() => Int, { description: "Cadastros aguardando aprovação." })
  pendingEnrollmentCount(): Promise<number> {
    return this.review.countPending();
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Query(() => EnrollmentRequestType)
  enrollmentRequest(
    @Args("id", { type: () => ID }, Id()) id: string,
  ): Promise<EnrollmentRequest> {
    return this.review.get(id);
  }

  @RequirePermissions(Permission.USERS_MANAGE, Permission.MEMBERS_MANAGE)
  @Mutation(() => EnrollmentApprovalType, {
    description:
      "Aprova o cadastro (com as correções): cria o usuário e o perfil de músico.",
  })
  approveEnrollmentRequest(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
    @Args("data") data: EnrollmentDataInput,
    @Args("group", { type: () => UserGroup }) group: UserGroup,
  ): Promise<EnrollmentApproval> {
    return this.review.approve(actor, id, data, group);
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Mutation(() => EnrollmentRequestType)
  rejectEnrollmentRequest(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
    @Args("reason") reason: string,
  ): Promise<EnrollmentRequest> {
    return this.review.reject(actor, id, reason.slice(0, 600));
  }
}

// The photo link is signed on demand (it expires), never stored.
@Resolver(() => EnrollmentRequestType)
export class EnrollmentRequestFieldsResolver {
  constructor(private readonly review: EnrollmentReviewUseCase) {}

  @ResolveField(() => String, { nullable: true })
  photoUrl(@Parent() request: EnrollmentRequest): Promise<string | null> {
    return this.review.photoUrl(request);
  }
}
