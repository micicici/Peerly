import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { AppError } from '../common/app-error';
import { User } from '../users/user.entity';
import { Message } from './message.entity';

/** Direct messages between two accounts. */
@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messages: Repository<Message>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async send(fromId: string, toId: string, body: string) {
    if (fromId === toId) {
      throw new AppError('FORBIDDEN', 'You cannot message yourself', 403);
    }
    const to = await this.users.findOne({ where: { id: toId } });
    if (!to) {
      throw new AppError('FORBIDDEN', 'User not found', 404);
    }
    return this.messages.save(
      this.messages.create({
        fromId,
        toId,
        body: body.trim(),
        readAt: null,
      }),
    );
  }

  async conversations(userId: string) {
    const rows = await this.messages
      .createQueryBuilder('m')
      .where('m.fromId = :userId OR m.toId = :userId', { userId })
      .orderBy('m.createdAt', 'DESC')
      .getMany();
    const grouped = new Map<string, Message[]>();
    for (const row of rows) {
      const otherId = row.fromId === userId ? row.toId : row.fromId;
      const list = grouped.get(otherId) ?? [];
      list.push(row);
      grouped.set(otherId, list);
    }
    const ids = [...grouped.keys()];
    if (ids.length === 0) {
      return [];
    }
    const people = await this.users.find({ where: { id: In(ids) } });
    const byId = new Map(people.map((person) => [person.id, person]));
    return ids
      .map((otherId) => {
        const messages = grouped.get(otherId) ?? [];
        const last = messages[0];
        const person = byId.get(otherId);
        if (!last || !person) {
          return null;
        }
        return {
          otherUser: {
            id: person.id,
            name: person.name,
            avatarUrl: person.avatarUrl,
            gender: person.gender,
          },
          lastMessage: {
            id: last.id,
            body: last.body,
            createdAt: last.createdAt,
            fromId: last.fromId,
          },
          unreadCount: messages.filter(
            (message) => message.toId === userId && message.readAt == null,
          ).length,
        };
      })
      .filter((row) => row !== null);
  }

  async thread(userId: string, otherId: string) {
    await this.messages.update(
      { toId: userId, fromId: otherId, readAt: IsNull() },
      { readAt: new Date() },
    );
    return this.messages
      .createQueryBuilder('m')
      .where(
        '(m.fromId = :userId AND m.toId = :otherId) OR (m.fromId = :otherId AND m.toId = :userId)',
        { userId, otherId },
      )
      .orderBy('m.createdAt', 'ASC')
      .getMany();
  }
}
