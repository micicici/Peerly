import { mkdirSync } from 'fs';
import { unlink } from 'fs/promises';
import { basename, extname, join } from 'path';
import { randomUUID } from 'crypto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'fs';
import { diskStorage } from 'multer';
import { AppError } from '../common/app-error';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { User } from '../users/user.entity';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  LESSON_MATERIALS_ROOT,
  contentDisposition,
  isAllowedLessonFile,
  lessonFileExtension,
} from './lesson-materials';

mkdirSync(LESSON_MATERIALS_ROOT, { recursive: true });

/** HTTP API for bookings, classroom access, and lesson materials. */
@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: User, @Body() dto: CreateBookingDto) {
    return this.bookings.create(user.id, dto.slotId, dto.offeringId);
  }

  @Get()
  listMine(@CurrentUser() user: User) {
    return this.bookings.listMine(user.id);
  }

  @Get(':id/classroom')
  classroom(@CurrentUser() user: User, @Param('id') id: string) {
    return this.bookings.classroomAccess(user.id, id);
  }

  @Post(':id/cancel')
  @HttpCode(201)
  cancel(@CurrentUser() user: User, @Param('id') id: string) {
    return this.bookings.cancelAsTeacher(user.id, id);
  }

  @Post(':id/materials')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const bookingId = String(req.params.id ?? '');
          if (
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              bookingId,
            )
          ) {
            cb(new AppError('NOT_FOUND', 'Class not found', 404), '');
            return;
          }
          const dir = join(LESSON_MATERIALS_ROOT, bookingId);
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = lessonFileExtension(file.originalname) ?? extname(file.originalname);
          cb(null, `${randomUUID()}${ext.toLowerCase()}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!isAllowedLessonFile(file.originalname, file.mimetype)) {
          cb(
            new AppError(
              'FORBIDDEN',
              'Attach a PDF, document, image, or zip (max 10 MB)',
              400,
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadMaterial(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @UploadedFile()
    file?: { originalname: string; filename: string; mimetype: string; size: number; path: string },
  ) {
    if (!file) {
      throw new AppError('FORBIDDEN', 'Choose a file to attach', 400);
    }
    try {
      return await this.bookings.attachMaterial(user.id, id, {
        originalName: file.originalname,
        storedName: basename(file.filename),
        mimeType: file.mimetype,
        size: file.size,
      });
    } catch (err) {
      await unlink(file.path).catch(() => undefined);
      throw err;
    }
  }

  @Get(':id/materials/:materialId')
  async downloadMaterial(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('materialId') materialId: string,
  ) {
    const file = await this.bookings.readMaterial(user.id, id, materialId);
    return new StreamableFile(createReadStream(file.path), {
      type: file.mimeType,
      disposition: contentDisposition(file.downloadName),
    });
  }
}
