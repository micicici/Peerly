import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../common/roles.decorator';
import { SkipOfferingRequired } from '../common/skip-offering-required.decorator';
import { MergeSubjectDto } from './dto/merge-subject.dto';
import { RenameSubjectDto } from './dto/rename-subject.dto';
import { SubjectModerationService } from './subject-moderation.service';

/** Admin-only subject catalog endpoints. */
@Controller('admin/subjects')
@Roles('ADMIN')
@SkipOfferingRequired()
export class AdminSubjectsController {
  constructor(private readonly subjects: SubjectModerationService) {}

  @Get()
  list() {
    return this.subjects.list();
  }

  @Patch(':id')
  rename(@Param('id') id: string, @Body() dto: RenameSubjectDto) {
    return this.subjects.rename(id, dto.name);
  }

  @Post(':id/merge')
  merge(@Param('id') id: string, @Body() dto: MergeSubjectDto) {
    return this.subjects.merge(id, dto.intoId);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.subjects.remove(id);
  }
}
