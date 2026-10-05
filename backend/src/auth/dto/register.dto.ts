import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Gender } from '../../users/user.entity';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  timezone: string;

  @IsString()
  @MinLength(10)
  bio: string;

  @IsIn(['male', 'female'])
  gender: Gender;

  @IsInt()
  @Min(1900)
  @Max(2100)
  yearOfBirth: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @IsString({ each: true })
  spokenLanguages: string[];
}
