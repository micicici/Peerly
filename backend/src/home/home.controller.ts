import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { OfferingsService } from '../offerings/offerings.service';
import { ReviewsService } from '../reviews/reviews.service';
import { UsersService } from '../users/users.service';

/** Public home feed, ordered by teacher popularity. */
@Controller('home')
export class HomeController {
  constructor(
    private readonly offerings: OfferingsService,
    private readonly reviews: ReviewsService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Get()
  async index() {
    const offerings = await this.offerings.listBrowse(undefined);
    const teacherIds = [...new Set(offerings.map((o) => o.teacherId))];
    const stats = await this.reviews.statsForTeachers(teacherIds);
    const scored = offerings.map((offering) => {
      const s = stats.get(offering.teacherId) ?? {
        avgRating: 0,
        ratingCount: 0,
        completedCount: 0,
      };
      return {
        ...offering,
        avgRating: s.avgRating,
        ratingCount: s.ratingCount,
        completedCount: s.completedCount,
        popularityScore: this.reviews.popularityScore({
          ...s,
          completedCount: s.completedCount,
        }),
      };
    });
    scored.sort((a, b) => b.popularityScore - a.popularityScore);
    const popularClasses = scored.slice(0, 8);
    const seen = new Set<string>();
    const popularTeachers: {
      id: string;
      name: string;
      bio: string | null;
      avatarUrl: string | null;
      gender: 'male' | 'female' | null;
      avgRating: number;
      ratingCount: number;
      completedCount: number;
      popularityScore: number;
    }[] = [];
    for (const row of scored) {
      if (seen.has(row.teacherId)) {
        continue;
      }
      seen.add(row.teacherId);
      const user = await this.users.findById(row.teacherId);
      if (!user) {
        continue;
      }
      popularTeachers.push({
        id: user.id,
        name: user.name,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        gender: user.gender,
        avgRating: row.avgRating,
        ratingCount: row.ratingCount,
        completedCount: row.completedCount,
        popularityScore: row.popularityScore,
      });
      if (popularTeachers.length === 6) {
        break;
      }
    }
    return { popularClasses, popularTeachers };
  }
}
