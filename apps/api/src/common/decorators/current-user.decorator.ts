import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Usage:
//   @CurrentUser()           → full user object from JWT payload
//   @CurrentUser('id')       → user.id only
//   @CurrentUser('roles')    → user.roles array
export const CurrentUser = createParamDecorator(
  (field: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return field ? request.user?.[field] : request.user;
  },
);
