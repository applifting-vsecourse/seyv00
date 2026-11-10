import { PickType } from '@nestjs/swagger';
import { CreateQuackDto } from './create-quack.dto';

// The same text and mood rules as a quack. There is no poll field, so the
// controller's forbidNonWhitelisted turns a reply with a poll into a 400.
export class CreateReplyDto extends PickType(CreateQuackDto, [
  'text',
  'mood',
] as const) {}
