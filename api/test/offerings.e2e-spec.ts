import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

describe('Offerings', () => {
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

  async function register(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'password12',
        name: 'Ada',
        timezone: 'Europe/Belgrade',
      })
      .expect(201);
    return res.body.token as string;
  }

  it('first offering grants 3 hours; second does not', async () => {
    const token = await register('teach@example.com');
    const me0 = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${token}`);
    expect(me0.body.offeringCount).toBe(0);
    expect(me0.body.balance).toBe(0);

    await request(app.getHttpServer())
      .post('/offerings')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Guitar', description: 'Chords', level: 'beginner' })
      .expect(201);

    const me1 = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${token}`);
    expect(me1.body.offeringCount).toBe(1);
    expect(me1.body.balance).toBe(3);

    await request(app.getHttpServer())
      .post('/offerings')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Piano', description: 'Keys', level: 'intermediate' })
      .expect(201);

    const me2 = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${token}`);
    expect(me2.body.balance).toBe(3);
    expect(me2.body.offeringCount).toBe(2);
  });

  it('GET /offerings/mine without offering is OFFERING_REQUIRED; POST /offerings is allowed', async () => {
    const token = await register('new@example.com');
    const mine = await request(app.getHttpServer())
      .get('/offerings/mine')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(mine.body.code).toBe('OFFERING_REQUIRED');

    await request(app.getHttpServer())
      .patch('/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'Hi' })
      .expect(200);
  });

  it('rejects deleting the only offering and hides it from other teachers browse', async () => {
    const teacher = await register('owner@example.com');
    const other = await register('other@example.com');

    const created = await request(app.getHttpServer())
      .post('/offerings')
      .set('Authorization', `Bearer ${teacher}`)
      .send({ title: 'Viola', description: 'Bow', level: 'beginner' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/offerings')
      .set('Authorization', `Bearer ${other}`)
      .send({ title: 'Drums', description: 'Rhythm', level: 'advanced' })
      .expect(201);

    const blocked = await request(app.getHttpServer())
      .delete(`/offerings/${created.body.id}`)
      .set('Authorization', `Bearer ${teacher}`)
      .expect(403);
    expect(blocked.body.code).toBe('FORBIDDEN');
    expect(blocked.body.message).toBe('You must keep at least one offering');

    const detail = await request(app.getHttpServer())
      .get(`/offerings/${created.body.id}`)
      .set('Authorization', `Bearer ${other}`)
      .expect(200);
    expect(detail.body.teacherName).toBe('Ada');
    expect(detail.body.openSlotCount).toBe(0);
    expect(detail.body.confirmedBookingCount).toBe(0);

    const browse = await request(app.getHttpServer())
      .get('/offerings')
      .query({ q: 'Viola', level: 'beginner' })
      .set('Authorization', `Bearer ${other}`)
      .expect(200);
    expect(browse.body).toEqual([
      expect.objectContaining({
        id: created.body.id,
        title: 'Viola',
        openSlotCount: 0,
        confirmedBookingCount: 0,
      }),
    ]);

    const ownBrowse = await request(app.getHttpServer())
      .get('/offerings')
      .set('Authorization', `Bearer ${teacher}`)
      .expect(200);
    expect(ownBrowse.body.map((row: { id: string }) => row.id)).not.toContain(
      created.body.id,
    );

    const second = await request(app.getHttpServer())
      .post('/offerings')
      .set('Authorization', `Bearer ${teacher}`)
      .send({ title: 'Harp', description: 'Strings', level: 'advanced' })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/offerings/${second.body.id}`)
      .set('Authorization', `Bearer ${teacher}`)
      .expect(200);
    const me = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${teacher}`);
    expect(me.body.offeringCount).toBe(1);
    expect(me.body.balance).toBe(3);
  });
});
