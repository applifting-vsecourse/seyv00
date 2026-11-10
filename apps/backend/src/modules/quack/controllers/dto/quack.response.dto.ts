import { Quack, QUACK_MOODS, QuackMood } from '@/modules/quack/domain/quack';
import { ApiProperty } from '@nestjs/swagger';
import { PollResponseDto } from './poll.response.dto';

class QuackUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  username!: string;
}

class ReplyParentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'The quack replied to was deleted' })
  isDeleted!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Null when the quack replied to was deleted',
  })
  username!: string | null;
}

export class QuackResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Null only when isDeleted',
  })
  text!: string | null;

  @ApiProperty({ enum: QUACK_MOODS, nullable: true })
  mood!: QuackMood | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Null only when isDeleted',
  })
  userId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({
    type: QuackUserDto,
    nullable: true,
    description: 'Null only when isDeleted',
  })
  user!: QuackUserDto | null;

  @ApiProperty({ type: PollResponseDto, nullable: true })
  poll!: PollResponseDto | null;

  @ApiProperty({
    description:
      'A deleted quack kept as a placeholder because it has replies: no text, mood, author or poll',
  })
  isDeleted!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The quack this one replies to; null on a top-level quack',
  })
  parentId!: string | null;

  @ApiProperty({
    type: ReplyParentDto,
    nullable: true,
    description:
      'What this reply answers, for its header; null on a top-level quack',
  })
  parent!: ReplyParentDto | null;

  @ApiProperty({ description: 'All replies, however many are included below' })
  replyCount!: number;

  @ApiProperty({
    type: () => [QuackResponseDto],
    description:
      'Oldest first: the first few in a list of quacks, all of them for a single thread, none on a reply',
  })
  replies!: QuackResponseDto[];

  static fromDomain(quack: Quack): QuackResponseDto {
    if (!quack.isDeleted && !quack.user) {
      throw new Error(
        `QuackResponseDto.fromDomain expected quack.user to be loaded for quack ${quack.id}`,
      );
    }
    return {
      id: quack.id,
      text: quack.text,
      mood: quack.mood,
      userId: quack.userId,
      createdAt: quack.createdAt,
      user: quack.user
        ? {
            id: quack.user.id,
            name: quack.user.name,
            username: quack.user.username,
          }
        : null,
      poll: quack.poll ? PollResponseDto.fromDomain(quack.poll) : null,
      isDeleted: quack.isDeleted,
      parentId: quack.parentId,
      parent: quack.parent,
      replyCount: quack.replyCount,
      replies: quack.replies.map(QuackResponseDto.fromDomain),
    };
  }
}
