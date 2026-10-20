import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const SEARCH_MAX_LENGTH = 100;

export class ListQuacksQueryDto {
  @ApiPropertyOptional({
    description:
      'Search words. A quack matches when every word appears in its text, ' +
      "its author's name or username — ignoring case, accents and a leading @.",
    example: 'duck pants',
    maxLength: SEARCH_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(SEARCH_MAX_LENGTH)
  q?: string;

  @ApiPropertyOptional({
    description: "Only the signed-in user's own quacks",
    example: true,
  })
  @IsOptional()
  // Query values arrive as text; anything but "true"/"false" fails IsBoolean.
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  mine?: boolean;
}
