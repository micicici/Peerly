import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

describe('Auth', () => {
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

  it('registers, logs in, and returns /me', async () => {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'a@example.com',
        password: 'password12',
        name: 'Ada',
        timezone: 'Europe/Belgrade',
        bio: 'I teach guitar and piano to beginners.',
        gender: 'female',
        yearOfBirth: 1990,
        spokenLanguages: ['English'],
      })
      .expect(201);
    expect(register.body.token).toEqual(expect.any(String));

    const me = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${register.body.token}`)
      .expect(200);
    expect(me.body.email).toBe('a@example.com');
    expect(me.body.balance).toBe(0);
    expect(me.body.offeringCount).toBe(0);
    expect(me.body.role).toBe('USER');

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'a@example.com', password: 'password12' })
      .expect(201);
    expect(login.body.token).toEqual(expect.any(String));
  });

  it('rejects missing JWT with UNAUTHENTICATED', async () => {
    const res = await request(app.getHttpServer()).get('/me').expect(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('rejects duplicate email with EMAIL_TAKEN', async () => {
    const body = {
      email: 'dup@example.com',
      password: 'password12',
      name: 'D',
      timezone: 'UTC',
      bio: 'I teach guitar and piano to beginners.',
      gender: 'female',
      yearOfBirth: 1990,
      spokenLanguages: ['English'],
    };
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(body)
      .expect(201);
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(body)
      .expect(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });
});
