import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CURRENT_USER_KEY } from 'src/utils/constants';

export const CurrentUser = createParamDecorator(
  (data: never, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    return request[CURRENT_USER_KEY];
  },
);
