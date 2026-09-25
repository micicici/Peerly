import { IsIn, IsString, MinLength } from 'class-validator';
import { OFFERING_LEVELS, OfferingLevel } from '../offering.entity';

export class CreateOfferingDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @MinLength(1)
  description: string;

  @IsIn(OFFERING_LEVELS)
  level: OfferingLevel;
}
