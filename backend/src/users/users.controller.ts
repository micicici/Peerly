import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Public } from '../common/public.decorator';
import { SkipOfferingRequired } from '../common/skip-offering-required.decorator';
import { LedgerService } from '../ledger/ledger.service';
import { OfferingsService } from '../offerings/offerings.service';
import { ReviewsService } from '../reviews/reviews.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { AppError } from '../common/app-error';
import { mkdirSync } from 'fs';

const avatarDir = join(process.cwd(), 'uploads', 'avatars');
mkdirSync(avatarDir, { recursive: true });

/** Current-user profile, avatars, and public teacher pages. */
@Controller()
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly ledger: LedgerService,
    private readonly offerings: OfferingsService,
    private readonly reviews: ReviewsService,
  ) {}

  @Get('me')
  @SkipOfferingRequired()
  me(@CurrentUser() user: User) {
    return this.toProfile(user);
  }

  @Patch('me')
  @SkipOfferingRequired()
  async updateMe(@CurrentUser() user: User, @Body() dto: UpdateMeDto) {
    const updated = await this.users.updateProfile(user.id, dto);
    return this.toProfile(updated);
  }

  @Post('me/avatar')
  @SkipOfferingRequired()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: avatarDir,
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new Error('Only images are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: User,
    @UploadedFile() file?: { filename: string },
  ) {
    if (!file) {
      throw new AppError('FORBIDDEN', 'Choose an image file', 400);
    }
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    const updated = await this.users.updateProfile(user.id, { avatarUrl });
    return this.toProfile(updated);
  }

  @Public()
  @Get('languages')
  languages() {
    return this.users.distinctLanguages();
  }

  @Public()
  @Get('users/:id')
  async publicProfile(@Param('id') id: string) {
    const user = await this.users.findById(id);
    if (!user) {
      throw new AppError('FORBIDDEN', 'User not found', 404);
    }
    const offerings = await this.offerings.listMine(id);
    const statsMap = await this.reviews.statsForTeachers([id]);
    const stats = statsMap.get(id) ?? {
      avgRating: 0,
      ratingCount: 0,
      completedCount: 0,
    };
    return {
      id: user.id,
      name: user.name,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      gender: user.gender,
      spokenLanguages: user.spokenLanguages ?? [],
      timezone: user.timezone,
      offerings,
      avgRating: stats.avgRating,
      ratingCount: stats.ratingCount,
      completedCount: stats.completedCount,
      popularityScore: this.reviews.popularityScore(stats),
    };
  }

  private async toProfile(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      gender: user.gender,
      yearOfBirth: user.yearOfBirth,
      spokenLanguages: user.spokenLanguages ?? [],
      timezone: user.timezone,
      role: user.role ?? 'USER',
      balance: await this.ledger.balanceFor(user.id),
      offeringCount: await this.offerings.countFor(user.id),
    };
  }
}
