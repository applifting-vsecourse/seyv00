import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateQuackDto } from './create-quack.dto';

// Same options as the controller's ValidationPipe.
const check = async (
  body: object,
): Promise<{ dto: CreateQuackDto; errors: string[] }> => {
  const dto = plainToInstance(CreateQuackDto, body);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const messages = (list: typeof errors): string[] =>
    list.flatMap((error) => [
      ...Object.values(error.constraints ?? {}),
      ...messages(error.children ?? []),
    ]);
  return { dto, errors: messages(errors) };
};

describe('CreateQuackDto poll', () => {
  it('accepts an ordinary quack without a poll', async () => {
    await expect(check({ text: 'hi' })).resolves.toMatchObject({ errors: [] });
    await expect(check({ text: 'hi', poll: null })).resolves.toMatchObject({
      errors: [],
    });
  });

  it('accepts 2–4 answers and trims them', async () => {
    const { dto, errors } = await check({
      text: 'Lunch?',
      poll: { options: ['  Pizza ', 'Thai', 'Salad', 'Soup'] },
    });
    expect(errors).toEqual([]);
    expect(dto.poll?.options).toEqual(['Pizza', 'Thai', 'Salad', 'Soup']);
  });

  it.each([
    ['one answer', ['Pizza']],
    ['five answers', ['a', 'b', 'c', 'd', 'e']],
    ['an empty answer', ['Pizza', '   ']],
    ['an answer over 50 characters', ['Pizza', 'x'.repeat(51)]],
    ['the same answer twice, ignoring case and spaces', ['Pizza', ' pizza ']],
    ['answers that are not text', ['Pizza', 4]],
  ])('rejects %s', async (_, options) => {
    const { errors } = await check({ text: 'Lunch?', poll: { options } });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('counts an emoji as one character, like the database', async () => {
    const { errors } = await check({
      text: 'Lunch?',
      poll: { options: ['🍕'.repeat(50), 'Thai'] },
    });
    expect(errors).toEqual([]);
  });

  it('rejects unknown fields inside the poll', async () => {
    const { errors } = await check({
      text: 'Lunch?',
      poll: { options: ['Pizza', 'Thai'], closesAt: 'tomorrow' },
    });
    expect(errors).toContain('property closesAt should not exist');
  });
});
