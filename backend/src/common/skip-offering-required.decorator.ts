import { SetMetadata } from '@nestjs/common';

export const SkipOfferingRequired = () =>
  SetMetadata('skipOfferingRequired', true);
