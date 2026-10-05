import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Public } from '../common/public.decorator';
import { SkipOfferingRequired } from '../common/skip-offering-required.decorator';
import { User } from '../users/user.entity';
import { CreateReportDto, CreateReviewDto } from './dto/review.dto';
import { ReviewsService } from './reviews.service';

/** Review listing, submission, and abuse reports. */
@Controller()
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get('users/:id/reviews')
  list(@Param('id') id: string) {
    return this.reviews.listForTeacher(id);
  }

  @Get('reviews/pending')
  @SkipOfferingRequired()
  pending(@CurrentUser() user: User) {
    return this.reviews.pendingForLearner(user.id);
  }

  @Get('reviews/eligibility/:teacherId')
  @SkipOfferingRequired()
  eligibility(
    @CurrentUser() user: User,
    @Param('teacherId') teacherId: string,
  ) {
    return this.reviews.eligibilityFor(user.id, teacherId);
  }

  @Post('reviews')
  @SkipOfferingRequired()
  create(@CurrentUser() user: User, @Body() dto: CreateReviewDto) {
    return this.reviews.createReview(user.id, dto);
  }

  @Post('reports')
  @SkipOfferingRequired()
  report(@CurrentUser() user: User, @Body() dto: CreateReportDto) {
    return this.reviews.createReport(user.id, dto);
  }
}
