import { IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';

export class CreateReviewDto {
  @IsUUID()
  teacherId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @MinLength(3)
  body: string;

  @IsOptional()
  @IsUUID()
  bookingId?: string;
}

export class CreateReportDto {
  @IsUUID()
  teacherId: string;

  @IsString()
  @MinLength(3)
  body: string;
}
