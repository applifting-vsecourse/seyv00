import {
  BIO_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from '@/modules/profile/domain/profile';
import { QUACK_MOODS, type QuackMood } from '@/modules/quack/domain/quack';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateProfileDto {
  @ApiProperty({
    description: 'Handle shown as @username',
    example: 'caffeinated.duck',
    minLength: USERNAME_MIN_LENGTH,
    maxLength: USERNAME_MAX_LENGTH,
    pattern: USERNAME_PATTERN.source,
  })
  @Transform(trim)
  @IsString()
  @Length(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH)
  @Matches(USERNAME_PATTERN, {
    message: 'username may only contain letters, numbers, dots and underscores',
  })
  username!: string;

  @ApiProperty({ description: 'Display name', example: 'Caffeinated Duck' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'Short bio',
    maxLength: BIO_MAX_LENGTH,
    nullable: true,
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(BIO_MAX_LENGTH)
  bio?: string | null;

  @ApiPropertyOptional({
    description: 'Mood preselected for new quacks',
    enum: QUACK_MOODS,
    nullable: true,
  })
  @IsOptional()
  @IsIn(QUACK_MOODS)
  defaultMood?: QuackMood | null;
}
