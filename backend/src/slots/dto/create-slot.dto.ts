import { IsISO8601 } from 'class-validator';

export class CreateSlotDto {
  @IsISO8601()
  startAt: string;
}
