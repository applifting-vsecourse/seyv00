import { Poll } from '@/modules/quack/domain/quack';
import { ApiProperty } from '@nestjs/swagger';

class PollOptionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  text!: string;

  @ApiProperty({
    description:
      'Always sent. Clients hide it until the viewer has voted or wrote the poll — ' +
      "that's about not swaying the vote, not secrecy.",
  })
  votes!: number;
}

export class PollResponseDto {
  @ApiProperty({ type: [PollOptionResponseDto] })
  options!: PollOptionResponseDto[];

  @ApiProperty()
  totalVotes!: number;

  @ApiProperty({ type: String, nullable: true })
  myOptionId!: string | null;

  @ApiProperty()
  isAuthor!: boolean;

  static fromDomain(poll: Poll): PollResponseDto {
    return {
      options: poll.options.map((option) => ({
        id: option.id,
        text: option.text,
        votes: option.votes,
      })),
      totalVotes: poll.totalVotes,
      myOptionId: poll.myOptionId,
      isAuthor: poll.isAuthor,
    };
  }
}
