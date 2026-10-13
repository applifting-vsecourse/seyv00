import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VoteDto {
  @ApiProperty({ description: 'The chosen answer of this poll' })
  @IsString()
  @IsNotEmpty()
  optionId!: string;
}
