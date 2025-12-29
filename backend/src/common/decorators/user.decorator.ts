import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return {
      id: request.session?.userId,
      email: request.session?.email,
      role: request.session?.role,
      libraryId: request.session?.libraryId,
    };
  },
);
