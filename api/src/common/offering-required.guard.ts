import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OfferingsService } from '../offerings/offerings.service';
import { User } from '../users/user.entity';
import { AppError } from './app-error';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class OfferingRequiredGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly offerings: OfferingsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(
      'skipOfferingRequired',
      [context.getHandler(), context.getClass()],
    );
    if (skip) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: User }>();
    if (!request.user) {
      return true;
    }

    const count = await this.offerings.countFor(request.user.id);
    if (count < 1) {
      throw new AppError('OFFERING_REQUIRED', 'Publish an offering first', 403);
    }
    return true;
  }
}
