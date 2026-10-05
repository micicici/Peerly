import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { OfferingsService } from './offerings.service';

/** Public list of subject names used by the catalog. */
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly offerings: OfferingsService) {}

  @Public()
  @Get()
  list() {
    return this.offerings.listSubjects();
  }
}
