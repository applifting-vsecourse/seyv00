import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListQuacksQueryDto } from './list-quacks.query.dto';

// Same options as the controller's ValidationPipe.
const check = async (
  query: object,
): Promise<{ dto: ListQuacksQueryDto; errors: number }> => {
  const dto = plainToInstance(ListQuacksQueryDto, query);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, errors: errors.length };
};

describe('ListQuacksQueryDto mine', () => {
  it.each([
    ['true', true],
    ['false', false],
  ])('reads ?mine=%s as %p', async (mine, expected) => {
    await expect(check({ mine })).resolves.toEqual({
      dto: expect.objectContaining({ mine: expected }),
      errors: 0,
    });
  });

  it('leaves mine out when it is not sent', async () => {
    const { dto, errors } = await check({});
    expect(errors).toBe(0);
    expect(dto.mine).toBeUndefined();
  });

  it.each(['yes', '1', ''])('rejects ?mine=%p', async (mine) => {
    await expect(check({ mine })).resolves.toMatchObject({ errors: 1 });
  });
});
