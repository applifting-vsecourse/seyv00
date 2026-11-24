import { LikeState } from '@/modules/quack/domain/quack';
import { ApiProperty } from '@nestjs/swagger';

// A quack's likes after a like or unlike. Who liked is never sent (ADR 0002).
export class LikeResponseDto {
  @ApiProperty({ description: 'Everyone’s likes, the caller’s included' })
  likeCount!: number;

  @ApiProperty({ description: 'Whether the caller likes the quack' })
  likedByMe!: boolean;

  static fromDomain(likes: LikeState): LikeResponseDto {
    return { likeCount: likes.likeCount, likedByMe: likes.likedByMe };
  }
}
