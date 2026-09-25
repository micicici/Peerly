import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

function nextUtcHour(): Date {
  const d = new Date();
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(d.getUTCHours() + 2);
  return d;
}

describe('Slots', () => {
  let app: INestApplication;
  let seq = 0;

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

  async function userWithOffering(): Promise<{
    token: string;
    offeringId: string;
  }> {
    seq += 1;
    const tokenRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `slot${seq}@example.com`,
        password: 'password12',
        name: 'Ada',
        timezone: 'Europe/Belgrade',
      })
      .expect(201);
    const token = tokenRes.body.token as string;
    const offering = await request(app.getHttpServer())
      .post('/offerings')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Guitar', description: 'Chords', level: 'beginner' })
      .expect(201);
    return { token, offeringId: offering.body.id as string };
  }

  it('creates on-the-hour slot and rejects overlap and off-hour', async () => {
    const { token, offeringId } = await userWithOffering();
    const start = nextUtcHour();
    const created = await request(app.getHttpServer())
      .post('/slots')
      .set('Authorization', `Bearer ${token}`)
      .send({ offeringId, startAt: start.toISOString() })
      .expect(201);
    expect(created.body.status).toBe('open');
    expect(created.body.endAt).toBe(
      new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
    );

    const overlap = await request(app.getHttpServer())
      .post('/slots')
      .set('Authorization', `Bearer ${token}`)
      .send({ offeringId, startAt: start.toISOString() })
      .expect(409);
    expect(overlap.body.code).toBe('SLOT_OVERLAP');

    const bad = await request(app.getHttpServer())
      .post('/slots')
      .set('Authorization', `Bearer ${token}`)
      .send({
        offeringId,
        startAt: new Date(start.getTime() + 15 * 60 * 1000).toISOString(),
      })
      .expect(400);
    expect(bad.body.code).toBe('SLOT_INVALID');
  });

  it('rejects past starts and offerings the teacher does not own', async () => {
    const owner = await userWithOffering();
    const other = await userWithOffering();
    const past = new Date();
    past.setUTCMinutes(0, 0, 0);
    past.setUTCHours(past.getUTCHours() - 1);

    const inPast = await request(app.getHttpServer())
      .post('/slots')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ offeringId: owner.offeringId, startAt: past.toISOString() })
      .expect(400);
    expect(inPast.body.code).toBe('SLOT_IN_PAST');

    const forbidden = await request(app.getHttpServer())
      .post('/slots')
      .set('Authorization', `Bearer ${other.token}`)
      .send({
        offeringId: owner.offeringId,
        startAt: nextUtcHour().toISOString(),
      })
      .expect(403);
    expect(forbidden.body.code).toBe('FORBIDDEN');
  });

  it('overlaps booked hours across offerings and allows the next hour or a cancelled hour', async () => {
    const { token, offeringId } = await userWithOffering();
    const start = nextUtcHour();
    const created = await request(app.getHttpServer())
      .post('/slots')
      .set('Authorization', `Bearer ${token}`)
      .send({ offeringId, startAt: start.toISOString() })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/offerings')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Piano', description: 'Keys', level: 'intermediate' })
      .expect(201);

    const cross = await request(app.getHttpServer())
      .post('/slots')
      .set('Authorization', `Bearer ${token}`)
      .send({
        offeringId: second.body.id,
        startAt: start.toISOString(),
      })
      .expect(409);
    expect(cross.body.code).toBe('SLOT_OVERLAP');

    const adjacent = new Date(start.getTime() + 60 * 60 * 1000);
    const next = await request(app.getHttpServer())
      .post('/slots')
      .set('Authorization', `Bearer ${token}`)
      .send({ offeringId, startAt: adjacent.toISOString() })
      .expect(201);
    expect(next.body.status).toBe('open');

    await app
      .get(DataSource)
      .query(`UPDATE slots SET status = 'booked' WHERE id = $1`, [
        created.body.id,
      ]);

    const bookedOverlap = await request(app.getHttpServer())
      .post('/slots')
      .set('Authorization', `Bearer ${token}`)
      .send({ offeringId, startAt: start.toISOString() })
      .expect(409);
    expect(bookedOverlap.body.code).toBe('SLOT_OVERLAP');

    await app
      .get(DataSource)
      .query(`UPDATE slots SET status = 'cancelled' WHERE id = $1`, [
        created.body.id,
      ]);

    const reused = await request(app.getHttpServer())
      .post('/slots')
      .set('Authorization', `Bearer ${token}`)
      .send({ offeringId, startAt: start.toISOString() })
      .expect(201);
    expect(reused.body.status).toBe('open');
  });

  it('lists future open slots, counts them on the offering, and deletes only open owned slots', async () => {
    const owner = await userWithOffering();
    const other = await userWithOffering();
    const start = nextUtcHour();
    const created = await request(app.getHttpServer())
      .post('/slots')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ offeringId: owner.offeringId, startAt: start.toISOString() })
      .expect(201);

    const listed = await request(app.getHttpServer())
      .get('/slots')
      .query({ offeringId: owner.offeringId })
      .set('Authorization', `Bearer ${other.token}`)
      .expect(200);
    expect(listed.body).toEqual([
      expect.objectContaining({
        id: created.body.id,
        status: 'open',
        offeringId: owner.offeringId,
      }),
    ]);

    const detail = await request(app.getHttpServer())
      .get(`/offerings/${owner.offeringId}`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(200);
    expect(detail.body.openSlotCount).toBe(1);
    expect(detail.body.confirmedBookingCount).toBe(0);

    const mine = await request(app.getHttpServer())
      .get('/slots/mine')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(mine.body.map((row: { id: string }) => row.id)).toContain(
      created.body.id,
    );

    await request(app.getHttpServer())
      .delete(`/slots/${created.body.id}`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/slots/${created.body.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    const afterDelete = await request(app.getHttpServer())
      .get('/slots')
      .query({ offeringId: owner.offeringId })
      .set('Authorization', `Bearer ${other.token}`)
      .expect(200);
    expect(afterDelete.body).toEqual([]);

    const detailAfter = await request(app.getHttpServer())
      .get(`/offerings/${owner.offeringId}`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(200);
    expect(detailAfter.body.openSlotCount).toBe(0);

    const again = await request(app.getHttpServer())
      .post('/slots')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ offeringId: owner.offeringId, startAt: start.toISOString() })
      .expect(201);
    await app
      .get(DataSource)
      .query(`UPDATE slots SET status = 'booked' WHERE id = $1`, [
        again.body.id,
      ]);

    const hidden = await request(app.getHttpServer())
      .get('/slots')
      .query({ offeringId: owner.offeringId })
      .set('Authorization', `Bearer ${other.token}`)
      .expect(200);
    expect(hidden.body).toEqual([]);

    const counted = await request(app.getHttpServer())
      .get(`/offerings/${owner.offeringId}`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(200);
    expect(counted.body.openSlotCount).toBe(0);

    const blocked = await request(app.getHttpServer())
      .delete(`/slots/${again.body.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(403);
    expect(blocked.body.code).toBe('FORBIDDEN');
  });

  it('rejects a slot id that is not a real slot', async () => {
    const fks: { referenced: string }[] = await app.get(DataSource).query(
      `SELECT r.relname AS referenced
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_class r ON r.oid = c.confrelid
       WHERE t.relname = 'bookings' AND c.contype = 'f'`,
    );
    expect(fks).toEqual([expect.objectContaining({ referenced: 'slots' })]);

    await expect(
      app.get(DataSource).query(
        `INSERT INTO bookings (id, "slotId", "learnerId", "teacherId", "offeringId", "joinUrl", status)
         VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'https://meet.jit.si/x', 'confirmed')`,
      ),
    ).rejects.toThrow(/foreign key/i);
  });

  it('does not delete a slot that was booked while the delete waited', async () => {
    const owner = await userWithOffering();
    const start = nextUtcHour();
    const created = await request(app.getHttpServer())
      .post('/slots')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ offeringId: owner.offeringId, startAt: start.toISOString() })
      .expect(201);

    const held = app.get(DataSource).createQueryRunner();
    await held.connect();
    await held.startTransaction();
    try {
      await held.query('SELECT id FROM slots WHERE id = $1 FOR UPDATE', [
        created.body.id,
      ]);

      const pending = request(app.getHttpServer())
        .delete(`/slots/${created.body.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .then((res) => res);

      const started = Date.now();
      let waiting = 0;
      while (Date.now() - started < 8000) {
        const rows: { n: number }[] = await app.get(DataSource).query(
          `SELECT COUNT(*)::int AS n
           FROM pg_stat_activity
           WHERE wait_event_type = 'Lock' AND pid <> pg_backend_pid()`,
        );
        waiting = rows[0]?.n ?? 0;
        if (waiting > 0) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      expect(waiting).toBeGreaterThan(0);

      await held.query(`UPDATE slots SET status = 'booked' WHERE id = $1`, [
        created.body.id,
      ]);
      await held.commitTransaction();

      const blocked = await pending;
      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe('FORBIDDEN');
    } finally {
      if (held.isTransactionActive) {
        await held.rollbackTransaction();
      }
      await held.release();
    }

    const rows: { status: string }[] = await app.get(DataSource).query(
      `SELECT status FROM slots WHERE id = $1`,
      [created.body.id],
    );
    expect(rows).toEqual([{ status: 'booked' }]);
  }, 20000);
});
