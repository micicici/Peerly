import { IsUUID } from 'class-validator';

export class MergeSubjectDto {
  @IsUUID()
  intoId: string;
}
