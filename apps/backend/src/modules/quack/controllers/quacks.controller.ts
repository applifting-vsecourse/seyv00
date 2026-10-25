import {
  PollNotFoundError,
  PollOptionNotFoundError,
  QuackNotFoundError,
} from '@/modules/quack/domain/quack';
import { QuacksService } from '@/modules/quack/services/quacks.service';
import { User } from '@/shared/auth/decorators/user.decorator';
import { Identity } from '@/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateQuackDto } from './dto/create-quack.dto';
import { ListQuacksQueryDto } from './dto/list-quacks.query.dto';
import { PollResponseDto } from './dto/poll.response.dto';
import { QuackResponseDto } from './dto/quack.response.dto';
import { VoteDto } from './dto/vote.dto';

@ApiTags('quacks')
@Controller('quacks')
@UseGuards(AuthenticatedUserGuard)
@ApiCookieAuth()
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class QuacksController {
  constructor(private readonly quacksService: QuacksService) {}

  @Get()
  @ApiOperation({
    summary: 'List quacks, optionally filtered by a search or to your own',
  })
  @ApiResponse({ status: 200, type: [QuackResponseDto] })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async list(
    @User() user: Identity,
    @Query() query: ListQuacksQueryDto,
  ): Promise<QuackResponseDto[]> {
    const quacks = await this.quacksService.searchQuacks(
      user,
      query.q,
      query.mine ?? false,
    );
    return quacks.map(QuackResponseDto.fromDomain);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a quack' })
  @ApiResponse({ status: 201, type: QuackResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid quack or poll' })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async create(
    @User() user: Identity,
    @Body() body: CreateQuackDto,
  ): Promise<QuackResponseDto> {
    const quack = await this.quacksService.createQuack(user, {
      text: body.text,
      mood: body.mood ?? null,
      pollOptions: body.poll?.options ?? null,
    });
    return QuackResponseDto.fromDomain(quack);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a quack: your own, or any quack as an admin',
  })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  @ApiResponse({
    status: 403,
    description: 'Someone else wrote this quack and you are not an admin',
  })
  @ApiResponse({ status: 404, description: 'No such quack' })
  async delete(
    @User() user: Identity,
    @Param('id') quackId: string,
  ): Promise<void> {
    try {
      await this.quacksService.deleteQuack(user, quackId);
    } catch (error) {
      if (error instanceof QuackNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  @Put(':id/vote')
  @ApiOperation({
    summary: 'Vote in a poll, or move your vote to another answer',
  })
  @ApiResponse({ status: 200, type: PollResponseDto })
  @ApiResponse({ status: 400, description: 'Answer is not part of this poll' })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  @ApiResponse({ status: 404, description: 'No such poll' })
  async vote(
    @User() user: Identity,
    @Param('id') quackId: string,
    @Body() body: VoteDto,
  ): Promise<PollResponseDto> {
    try {
      const poll = await this.quacksService.vote(user, quackId, body.optionId);
      return PollResponseDto.fromDomain(poll);
    } catch (error) {
      if (error instanceof PollNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof PollOptionNotFoundError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
