import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { MeetingsService } from '../src/meetings/meetings.service';

function nextUtcHour(): Date {
  const d = new Date();
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(d.getUTCHours() + 2);
  return d;
}

describe('Bookings', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    await app.get(DataSource).synchronize(true);
  });

  afterAll(async () => app.close());

  async function userWithOfferingOn(
    target: INestApplication,
    email: string,
  ): Promise<{ token: string; offeringId: string }> {
    const tokenRes = await request(target.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'password12',
        name: 'Ada',
        timezone: 'Europe/Belgrade',
      })
      .expect(201);
    const token = tokenRes.body.token as string;
    const offering = await request(target.getHttpServer())
      .post('/offerings')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Guitar', description: 'Chords', level: 'beginner' })
      .expect(201);
    return { token, offeringId: offering.body.id as string };
  }

  function userWithOffering(email: string) {
    return userWithOfferingOn(app, email);
  }

  async function createSlotOn(
    target: INestApplication,
    token: string,
    offeringId: string,
    start: Date,
  ): Promise<{ id: string }> {
    const created = await request(target.getHttpServer())
      .post('/slots')
      .set('Authorization', `Bearer ${token}`)
      .send({ offeringId, startAt: start.toISOString() })
      .expect(201);
    return created.body as { id: string };
  }

  function createSlot(token: string, offeringId: string, start: Date) {
    return createSlotOn(app, token, offeringId, start);
  }

  function getMeOn(target: INestApplication, token: string) {
    return request(target.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${token}`);
  }

  function getMe(token: string) {
    return getMeOn(app, token);
  }

  it('moves hours on book and reverses on teacher cancel', async () => {
    const teacher = await userWithOffering('t@example.com');
    const learner = await userWithOffering('l@example.com');
    const slot = await createSlot(
      teacher.token,
      teacher.offeringId,
      nextUtcHour(),
    );

    const book = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${learner.token}`)
      .send({ slotId: slot.id })
      .expect(201);
    expect(book.body.joinUrl).toMatch(/^https:\/\/meet\.jit\.si\/p2plearn-/);

    expect((await getMe(teacher.token)).body.balance).toBe(4);
    expect((await getMe(learner.token)).body.balance).toBe(2);

    const learnerLedger = await request(app.getHttpServer())
      .get('/ledger')
      .set('Authorization', `Bearer ${learner.token}`)
      .expect(200);
    expect(learnerLedger.body[0]).toEqual(
      expect.objectContaining({
        type: 'spend',
        amount: -1,
        bookingId: book.body.id,
      }),
    );
    expect(learnerLedger.body.map((row: { type: string }) => row.type)).toEqual(
      ['spend', 'starter'],
    );

    const listed = await request(app.getHttpServer())
      .get('/bookings')
      .set('Authorization', `Bearer ${teacher.token}`)
      .expect(200);
    expect(listed.body.map((row: { id: string }) => row.id)).toContain(
      book.body.id,
    );

    const bookedOffering = await request(app.getHttpServer())
      .get(`/offerings/${teacher.offeringId}`)
      .set('Authorization', `Bearer ${learner.token}`)
      .expect(200);
    expect(bookedOffering.body.confirmedBookingCount).toBe(1);

    await request(app.getHttpServer())
      .post(`/bookings/${book.body.id}/cancel`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .expect(201);

    expect((await getMe(teacher.token)).body.balance).toBe(3);
    expect((await getMe(learner.token)).body.balance).toBe(3);

    const teacherSlots = await request(app.getHttpServer())
      .get('/slots/mine')
      .set('Authorization', `Bearer ${teacher.token}`)
      .expect(200);
    expect(
      teacherSlots.body.find((row: { id: string }) => row.id === slot.id)
        ?.status,
    ).toBe('cancelled');

    const afterCancel = await request(app.getHttpServer())
      .get('/ledger')
      .set('Authorization', `Bearer ${learner.token}`)
      .expect(200);
    expect(afterCancel.body.map((row: { type: string }) => row.type)).toEqual([
      'refund',
      'spend',
      'starter',
    ]);

    const cancelledOffering = await request(app.getHttpServer())
      .get(`/offerings/${teacher.offeringId}`)
      .set('Authorization', `Bearer ${learner.token}`)
      .expect(200);
    expect(cancelledOffering.body.confirmedBookingCount).toBe(0);
  });

  it('SELF_BOOK then INSUFFICIENT_HOURS after three books', async () => {
    const teacher = await userWithOffering('t2@example.com');
    const learner = await userWithOffering('l2@example.com');
    const selfSlot = await createSlot(
      teacher.token,
      teacher.offeringId,
      nextUtcHour(),
    );
    const self = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ slotId: selfSlot.id })
      .expect(400);
    expect(self.body.code).toBe('SELF_BOOK');

    const hours = [3, 4, 5, 6].map((h) => {
      const d = nextUtcHour();
      d.setUTCHours(d.getUTCHours() + h);
      return d;
    });
    for (const start of hours) {
      await createSlot(teacher.token, teacher.offeringId, start);
    }
    const open = await request(app.getHttpServer())
      .get(`/slots?offeringId=${teacher.offeringId}`)
      .set('Authorization', `Bearer ${learner.token}`);
    const ids = open.body.map((s: { id: string }) => s.id);
    await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${learner.token}`)
      .send({ slotId: ids[0] })
      .expect(201);
    await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${learner.token}`)
      .send({ slotId: ids[1] })
      .expect(201);
    await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${learner.token}`)
      .send({ slotId: ids[2] })
      .expect(201);
    const fourth = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${learner.token}`)
      .send({ slotId: ids[3] })
      .expect(400);
    expect(fourth.body.code).toBe('INSUFFICIENT_HOURS');
  });

  it('only one of two concurrent books succeeds', async () => {
    const teacher = await userWithOffering('ct@example.com');
    const a = await userWithOffering('ca@example.com');
    const b = await userWithOffering('cb@example.com');
    const slot = await createSlot(
      teacher.token,
      teacher.offeringId,
      nextUtcHour(),
    );
    const [r1, r2] = await Promise.all([
      request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ slotId: slot.id }),
      request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${b.token}`)
        .send({ slotId: slot.id }),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);
    const failed = r1.status === 409 ? r1 : r2;
    expect(failed.body.code).toBe('SLOT_GONE');
    const winnerTok = r1.status === 201 ? a.token : b.token;
    const loserTok = r1.status === 201 ? b.token : a.token;
    expect((await getMe(winnerTok)).body.balance).toBe(2);
    expect((await getMe(loserTok)).body.balance).toBe(3);
  });

  it('learner cancel is FORBIDDEN', async () => {
    const teacher = await userWithOffering('tc@example.com');
    const learner = await userWithOffering('lc@example.com');
    const slot = await createSlot(
      teacher.token,
      teacher.offeringId,
      nextUtcHour(),
    );
    const book = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${learner.token}`)
      .send({ slotId: slot.id })
      .expect(201);
    const res = await request(app.getHttpServer())
      .post(`/bookings/${book.body.id}/cancel`)
      .set('Authorization', `Bearer ${learner.token}`)
      .expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('rolls back hours if join URL is empty', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MeetingsService)
      .useValue({ createJoinUrl: () => '' })
      .compile();
    const app2 = moduleRef.createNestApplication();
    app2.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app2.init();
    const teacher = await userWithOfferingOn(app2, 'tf@example.com');
    const learner = await userWithOfferingOn(app2, 'lf@example.com');
    const slot = await createSlotOn(
      app2,
      teacher.token,
      teacher.offeringId,
      nextUtcHour(),
    );
    await request(app2.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${learner.token}`)
      .send({ slotId: slot.id })
      .expect(500);
    expect((await getMeOn(app2, learner.token)).body.balance).toBe(3);
    const open = await request(app2.getHttpServer())
      .get(`/slots?offeringId=${teacher.offeringId}`)
      .set('Authorization', `Bearer ${learner.token}`);
    expect(open.body).toHaveLength(1);
    await app2.close();
  });
});
