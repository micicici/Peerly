import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { OFFERING_LEVELS, OfferingLevel } from '../offering.entity';

export class UpdateOfferingDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @IsOptional()
  @IsIn(OFFERING_LEVELS)
  level?: OfferingLevel;

  @IsOptional()
  @IsString()
  @MinLength(1)
  subjectName?: string;
}
