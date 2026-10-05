import 'reflect-metadata';
import { existsSync, readFileSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { join } from 'path';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from './app.module';
import { Booking } from './bookings/booking.entity';
import { LedgerEntry } from './ledger/ledger-entry.entity';
import { Message } from './messages/message.entity';
import { OfferingLevel } from './offerings/offering.entity';
import { OfferingsService } from './offerings/offerings.service';
import { Subject } from './offerings/subject.entity';
import { Review } from './reviews/review.entity';
import { Slot } from './slots/slot.entity';
import { Gender, User } from './users/user.entity';
import { UsersService } from './users/users.service';

const PASSWORD = 'SeedPass123';
const STARTER_HOURS = 3;

const SUBJECTS = [
  'Mathematics',
  'Web Development',
  'English',
  'Digital Art',
  'Cooking',
  'Physics',
  'History',
  'Music',
  'Spanish',
] as const;

type SeedPerson = {
  email: string;
  name: string;
  bio: string;
  gender: Gender;
  yearOfBirth: number;
  timezone: string;
  spokenLanguages: string[];
  admin?: boolean;
};

type SeedOffering = {
  teacherEmail: string;
  title: string;
  description: string;
  level: OfferingLevel;
  subjectName: (typeof SUBJECTS)[number];
};

const PEOPLE: SeedPerson[] = [
  {
    email: 'admin@p2p-learn.test',
    name: 'Priya Raman',
    bio: 'Catalog moderator for P2P Learn. I keep subject names tidy so teachers and students can find the right class.',
    gender: 'female',
    yearOfBirth: 1988,
    timezone: 'Europe/London',
    spokenLanguages: ['English', 'Tamil'],
    admin: true,
  },
  {
    email: 'mira.novak@p2p-learn.test',
    name: 'Mira Novak',
    bio: 'High-school math and physics teacher. I turn stuck problems into a method a student can finish alone.',
    gender: 'female',
    yearOfBirth: 1992,
    timezone: 'Europe/Belgrade',
    spokenLanguages: ['English', 'Serbian'],
  },
  {
    email: 'jonah.ellis@p2p-learn.test',
    name: 'Jonah Ellis',
    bio: 'Frontend engineer teaching practical web development, from a first React page to APIs that are safe to ship.',
    gender: 'male',
    yearOfBirth: 1990,
    timezone: 'America/New_York',
    spokenLanguages: ['English'],
  },
  {
    email: 'sofia.alvarez@p2p-learn.test',
    name: 'Sofia Alvarez',
    bio: 'Language tutor from Valencia. Spanish and English classes are conversation-first, with grammar only when it helps you speak.',
    gender: 'female',
    yearOfBirth: 1995,
    timezone: 'Europe/Madrid',
    spokenLanguages: ['Spanish', 'English'],
  },
  {
    email: 'theo.park@p2p-learn.test',
    name: 'Theo Park',
    bio: 'Illustrator and pianist helping students finish a piece they can show, not a folder of unfinished sketches.',
    gender: 'male',
    yearOfBirth: 1994,
    timezone: 'America/Los_Angeles',
    spokenLanguages: ['English', 'Korean'],
  },
  {
    email: 'amira.hassan@p2p-learn.test',
    name: 'Amira Hassan',
    bio: 'Home cook and history reader. Classes stay practical: one dish you can repeat, or one era you can explain.',
    gender: 'female',
    yearOfBirth: 1998,
    timezone: 'Africa/Cairo',
    spokenLanguages: ['Arabic', 'English'],
  },
];

const OFFERINGS: SeedOffering[] = [
  {
    teacherEmail: 'mira.novak@p2p-learn.test',
    title: 'Algebra foundations',
    subjectName: 'Mathematics',
    level: 'beginner',
    description:
      'Linear equations, factoring, and word problems for students who need a calm hour to rebuild the basics.',
  },
  {
    teacherEmail: 'mira.novak@p2p-learn.test',
    title: 'Mechanics for beginners',
    subjectName: 'Physics',
    level: 'beginner',
    description:
      'Forces, motion, and free-body diagrams, with the story first and the equation second.',
  },
  {
    teacherEmail: 'jonah.ellis@p2p-learn.test',
    title: 'React for beginners',
    subjectName: 'Web Development',
    level: 'beginner',
    description:
      'Components, props, and a small page you can refresh and understand. We stay with the parts you will use this week.',
  },
  {
    teacherEmail: 'jonah.ellis@p2p-learn.test',
    title: 'API design workshop',
    subjectName: 'Web Development',
    level: 'advanced',
    description:
      'Shape a JSON API: resource names, errors, and auth boundaries. We leave with a contract a client can call.',
  },
  {
    teacherEmail: 'sofia.alvarez@p2p-learn.test',
    title: 'Conversational Spanish',
    subjectName: 'Spanish',
    level: 'beginner',
    description:
      'Everyday speaking practice: introductions, plans, and the phrases you need with a host family or a coworker.',
  },
  {
    teacherEmail: 'sofia.alvarez@p2p-learn.test',
    title: 'Everyday English',
    subjectName: 'English',
    level: 'intermediate',
    description:
      'Conversation for work and travel. You lead the dialogue, and we only pause for grammar when a sentence gets stuck.',
  },
  {
    teacherEmail: 'theo.park@p2p-learn.test',
    title: 'Digital illustration studio',
    subjectName: 'Digital Art',
    level: 'intermediate',
    description:
      'Thumbnail, value study, and color for one finished piece. Bring Procreate, Photoshop, or Krita.',
  },
  {
    teacherEmail: 'theo.park@p2p-learn.test',
    title: 'Piano for beginners',
    subjectName: 'Music',
    level: 'beginner',
    description:
      'Hands, rhythm, and a short piece you can play by the end of the hour. A keyboard or piano at home is enough.',
  },
  {
    teacherEmail: 'amira.hassan@p2p-learn.test',
    title: 'Weeknight cooking',
    subjectName: 'Cooking',
    level: 'beginner',
    description:
      'One complete meal from a short shopping list. We cook it together and write down the steps you will reuse.',
  },
  {
    teacherEmail: 'amira.hassan@p2p-learn.test',
    title: 'Modern world history',
    subjectName: 'History',
    level: 'intermediate',
    description:
      'A single era, told through people and decisions rather than a list of dates. Bring a topic you want to explain clearly.',
  },
];

function loadEnvFile(path: string): void {
  if (!existsSync(path)) {
    return;
  }
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function avatarFor(name: string): string {
  return `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(name)}`;
}

async function wipeDatabase(dataSource: DataSource): Promise<void> {
  const rows: { tablename: string }[] = await dataSource.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  if (rows.length === 0) {
    return;
  }
  const names = rows
    .map((row) => `"${row.tablename.replace(/"/g, '""')}"`)
    .join(', ');
  await dataSource.query(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
}

async function grantStarter(
  ledger: Repository<LedgerEntry>,
  userId: string,
): Promise<void> {
  const existing = await ledger.findOne({
    where: { userId, type: 'starter' },
  });
  if (existing) {
    if (existing.amount !== STARTER_HOURS || existing.bookingId !== null) {
      throw new Error(`Starter credit for ${userId} is not ${STARTER_HOURS} hours`);
    }
    return;
  }
  await ledger.save(
    ledger.create({
      userId,
      amount: STARTER_HOURS,
      type: 'starter',
      bookingId: null,
    }),
  );
}

async function seed(): Promise<void> {
  loadEnvFile(join(__dirname, '..', '.env'));
  loadEnvFile(join(__dirname, '..', '..', '.env'));

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const users = app.get(UsersService);
    const offerings = app.get(OfferingsService);
    const dataSource = app.get(DataSource);
    const people = dataSource.getRepository(User);
    const subjects = dataSource.getRepository(Subject);
    const ledger = dataSource.getRepository(LedgerEntry);
    const bookings = dataSource.getRepository(Booking);
    const slots = dataSource.getRepository(Slot);
    const reviews = dataSource.getRepository(Review);
    const messages = dataSource.getRepository(Message);

    await wipeDatabase(dataSource);

    const byEmail = new Map<string, User>();
    for (const person of PEOPLE) {
      const created = await users.create({
        email: person.email,
        password: PASSWORD,
        name: person.name,
        timezone: person.timezone,
        bio: person.bio,
        gender: person.gender,
        yearOfBirth: person.yearOfBirth,
        spokenLanguages: person.spokenLanguages,
      });
      await people.update(created.id, {
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        avatarUrl: avatarFor(person.name),
        role: person.admin ? 'ADMIN' : 'USER',
      });
      const saved = await users.findById(created.id);
      if (!saved) {
        throw new Error(`Seed user missing after save: ${person.email}`);
      }
      byEmail.set(person.email, saved);
    }

    for (const item of OFFERINGS) {
      const teacher = byEmail.get(item.teacherEmail);
      if (!teacher || teacher.role !== 'USER') {
        throw new Error(`Missing standard user ${item.teacherEmail}`);
      }
      await offerings.create(teacher.id, {
        title: item.title,
        description: item.description,
        level: item.level,
        subjectName: item.subjectName,
      });
    }

    for (const person of PEOPLE) {
      const user = byEmail.get(person.email);
      if (!user) {
        throw new Error(`Missing user ${person.email}`);
      }
      await grantStarter(ledger, user.id);
    }

    const allUsers = await people.find();
    const adminCount = allUsers.filter((user) => user.role === 'ADMIN').length;
    const standard = allUsers.filter((user) => user.role === 'USER');
    if (allUsers.length !== PEOPLE.length || adminCount !== 1 || standard.length !== 5) {
      throw new Error(
        `Expected 1 admin and 5 users, found ${adminCount} admin and ${standard.length} users`,
      );
    }

    const subjectRows = await subjects.find();
    const subjectNames = subjectRows.map((subject) => subject.name).sort();
    const expectedSubjects = [...SUBJECTS].sort();
    if (
      subjectNames.length !== expectedSubjects.length ||
      subjectNames.some((name, index) => name !== expectedSubjects[index])
    ) {
      throw new Error(
        `Expected subjects ${expectedSubjects.join(', ')}, found ${subjectNames.join(', ')}`,
      );
    }

    for (const user of standard) {
      const count = await offerings.countFor(user.id);
      if (count < 1) {
        throw new Error(`${user.email} has no published offering`);
      }
    }

    const bookingCount = await bookings.count();
    const slotCount = await slots.count();
    const reviewCount = await reviews.count();
    const messageCount = await messages.count();
    if (bookingCount || slotCount || reviewCount || messageCount) {
      throw new Error(
        `Expected an empty schedule and history, found bookings=${bookingCount} slots=${slotCount} reviews=${reviewCount} messages=${messageCount}`,
      );
    }

    const ledgerRows = await ledger.find();
    if (ledgerRows.length !== allUsers.length) {
      throw new Error(
        `Expected ${allUsers.length} starter credits, found ${ledgerRows.length} ledger rows`,
      );
    }
    for (const user of allUsers) {
      const rows = ledgerRows.filter((row) => row.userId === user.id);
      const balance = rows.reduce((sum, row) => sum + row.amount, 0);
      const clean =
        rows.length === 1 &&
        rows[0].type === 'starter' &&
        rows[0].amount === STARTER_HOURS &&
        rows[0].bookingId === null;
      if (!clean || balance !== STARTER_HOURS) {
        throw new Error(`${user.email} balance is ${balance}, expected ${STARTER_HOURS}`);
      }
    }

    const admin = allUsers.find((user) => user.role === 'ADMIN');
    const samples = standard.slice(0, 2);
    if (!admin || samples.length < 2) {
      throw new Error('Could not print login credentials');
    }

    console.log('');
    console.log('Seed complete. Database was truncated, then reloaded.');
    console.log('');
    console.log(
      `Users: ${allUsers.length} (1 admin, ${standard.length} standard). Each balance: ${STARTER_HOURS} hours.`,
    );
    console.log(
      `Subjects: ${subjectRows.length}. Offerings: ${OFFERINGS.length}, all published.`,
    );
    console.log(
      'Bookings: 0. Slots: 0. Reviews: 0. Messages: 0. Class history and the schedule grid are empty.',
    );
    console.log(
      'Ledger: one starter credit per user (the opening 3-hour balance). No class ledger history.',
    );
    console.log('');
    console.log('Login credentials');
    console.log('-----------------');
    console.log('Admin');
    console.log(`  email:    ${admin.email}`);
    console.log(`  password: ${PASSWORD}`);
    console.log('');
    for (const user of samples) {
      console.log(user.name);
      console.log(`  email:    ${user.email}`);
      console.log(`  password: ${PASSWORD}`);
      console.log('');
    }
  } finally {
    await app.close();
  }
}

seed().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
