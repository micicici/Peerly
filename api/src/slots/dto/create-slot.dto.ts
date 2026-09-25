import { IsISO8601, IsUUID } from 'class-validator';

export class CreateSlotDto {
  @IsUUID()
  offeringId: string;

  @IsISO8601()
  startAt: string;
}
