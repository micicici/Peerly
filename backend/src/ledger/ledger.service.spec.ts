import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LedgerService } from './ledger.service';
import { LedgerEntry } from './ledger-entry.entity';
import { User } from '../users/user.entity';

describe('LedgerService', () => {
  let service: LedgerService;
  let dataSource: DataSource;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DATABASE_HOST ?? 'localhost',
          port: Number(process.env.DATABASE_PORT ?? 5432),
          username: process.env.DATABASE_USER ?? 'p2p',
          password: process.env.DATABASE_PASSWORD ?? 'p2p',
          database: process.env.DATABASE_NAME ?? 'p2p_learn',
          entities: [User, LedgerEntry],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([LedgerEntry, User]),
      ],
      providers: [LedgerService],
    }).compile();
    service = moduleRef.get(LedgerService);
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);
  });

  async function user(): Promise<string> {
    const u = await dataSource.getRepository(User).save({
      email: `led-${Date.now()}@example.com`,
      passwordHash: 'x',
      name: 'L',
      timezone: 'UTC',
      spokenLanguages: [],
      role: 'USER',
    });
    return u.id;
  }

  it('inserts one starter +3 and rejects a second starter', async () => {
    const userId = await user();
    expect(await service.balanceFor(userId)).toBe(0);
    await service.insert({ userId, amount: 3, type: 'starter' });
    expect(await service.balanceFor(userId)).toBe(3);
    await expect(
      service.insert({ userId, amount: 3, type: 'starter' }),
    ).rejects.toThrow();
    expect(await service.balanceFor(userId)).toBe(3);
  });

  it('balanceFor with a manager locks the user ledger rows until the transaction ends', async () => {
    const userId = await user();
    await service.insert({ userId, amount: 3, type: 'starter' });

    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered!: () => void;
    const holding = new Promise<void>((resolve) => {
      entered = resolve;
    });

    const first = dataSource.transaction(async (manager) => {
      await service.balanceFor(userId, manager);
      entered();
      await hold;
    });

    await holding;

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    let blocked = false;
    try {
      await queryRunner.query(`SET LOCAL lock_timeout = '400ms'`);
      try {
        await service.balanceFor(userId, queryRunner.manager);
      } catch (err) {
        blocked = /lock timeout/i.test(String(err));
        if (!blocked) throw err;
      }
    } finally {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      release();
      await first;
    }
    expect(blocked).toBe(true);
  });

  it('spend changes SUM', async () => {
    const userId = await user();
    const bookingId = '11111111-1111-4111-8111-111111111111';
    await service.insert({ userId, amount: 3, type: 'starter' });
    await service.insert({ userId, amount: -1, type: 'spend', bookingId });
    expect(await service.balanceFor(userId)).toBe(2);
  });
});
