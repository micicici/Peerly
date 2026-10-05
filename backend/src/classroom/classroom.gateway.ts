import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AppError } from '../common/app-error';
import {
  BookingsService,
  ClassroomAccess,
} from '../bookings/bookings.service';
import { parseBegin, parseEnd, parsePoints, RoomBoard } from './whiteboard';

export function classroomRoom(bookingId: string): string {
  return `booking:${bookingId}`;
}

type ClientData = {
  userId?: string;
  bookingId?: string;
  role?: ClassroomAccess['role'];
};

type SignalBody = {
  sdp?: unknown;
  candidate?: unknown;
};

/** Socket.io signaling and shared whiteboard state for a lesson room. */
@WebSocketGateway({
  namespace: '/classroom',
  cors: {
    origin: ['http://localhost:1150', 'http://localhost:4200'],
  },
})
export class ClassroomGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly logger = new Logger(ClassroomGateway.name);
  private readonly replaced = new Set<string>();
  private readonly boards = new Map<string, RoomBoard>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly bookings: BookingsService,
    private readonly jwt: JwtService,
  ) {}

  afterInit(server: Server): void {
    server.use((socket, next) => {
      const token = (socket.handshake.auth as { token?: unknown } | undefined)
        ?.token;
      if (typeof token !== 'string' || token.length === 0) {
        next(new Error('UNAUTHENTICATED'));
        return;
      }
      try {
        const payload = this.jwt.verify<{ sub?: string }>(token);
        if (!payload.sub) {
          next(new Error('UNAUTHENTICATED'));
          return;
        }
        clientData(socket).userId = payload.sub;
        next();
      } catch {
        next(new Error('UNAUTHENTICATED'));
      }
    });
  }

  handleDisconnect(client: Socket): void {
    if (this.replaced.delete(client.id)) {
      return;
    }
    const bookingId = clientData(client).bookingId;
    if (!bookingId || !this.server) {
      return;
    }
    this.server.to(classroomRoom(bookingId)).emit('peer-left');
    void this.dropBoardIfEmpty(bookingId);
    this.logger.log(`Left classroom ${bookingId}`);
  }

  @SubscribeMessage('join')
  async join(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { bookingId?: string },
  ): Promise<void> {
    const userId = clientData(client).userId;
    const bookingId = body?.bookingId;
    if (!userId || typeof bookingId !== 'string' || bookingId.length === 0) {
      client.emit('classroom-error', {
        code: 'UNAUTHENTICATED',
        message: 'You need to sign in to join this class.',
      });
      return;
    }

    let access: ClassroomAccess;
    try {
      access = await this.bookings.classroomAccess(userId, bookingId);
    } catch (error) {
      const known = error instanceof AppError;
      client.emit('classroom-error', {
        code: known ? error.code : 'FORBIDDEN',
        message: known ? error.message : 'You cannot join this class.',
      });
      return;
    }

    const room = classroomRoom(bookingId);
    const prior = await this.server.in(room).fetchSockets();
    for (const socket of prior) {
      if (socket.id !== client.id && socket.data.userId === userId) {
        this.replaced.add(socket.id);
        socket.disconnect(true);
      }
    }
    const otherUsers = new Set(
      prior
        .filter(
          (socket) => socket.id !== client.id && socket.data.userId !== userId,
        )
        .map((socket) => String(socket.data.userId)),
    );
    if (otherUsers.size > 1) {
      client.emit('classroom-error', {
        code: 'ROOM_FULL',
        message: 'This class already has both participants.',
      });
      return;
    }

    const data = clientData(client);
    data.bookingId = bookingId;
    data.role = access.role;
    await client.join(room);
    const peerPresent = otherUsers.size === 1;
    client.emit('joined', {
      role: access.role,
      peerName: access.peerName,
      peerPresent,
      shouldOffer: peerPresent && access.role === 'teacher',
    });
    if (peerPresent) {
      client.to(room).emit('peer-joined');
    }
    client.emit('whiteboard-snapshot', {
      strokes: this.boardFor(bookingId).snapshot(),
    });
  }

  @SubscribeMessage('offer')
  offer(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SignalBody,
  ): void {
    this.relay(client, 'offer', { sdp: body?.sdp });
  }

  @SubscribeMessage('answer')
  answer(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SignalBody,
  ): void {
    this.relay(client, 'answer', { sdp: body?.sdp });
  }

  @SubscribeMessage('ice-candidate')
  iceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SignalBody,
  ): void {
    this.relay(client, 'ice-candidate', { candidate: body?.candidate });
  }

  @SubscribeMessage('leave')
  leave(@ConnectedSocket() client: Socket): void {
    client.disconnect();
  }

  @SubscribeMessage('whiteboard-begin')
  whiteboardBegin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): void {
    const stroke = parseBegin(body);
    const room = this.joined(client);
    if (!stroke || !room) {
      return;
    }
    if (!this.boardFor(room.bookingId).begin(room.userId, stroke)) {
      return;
    }
    client.to(classroomRoom(room.bookingId)).emit('whiteboard-begin', stroke);
  }

  @SubscribeMessage('whiteboard-points')
  whiteboardPoints(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): void {
    const parsed = parsePoints(body);
    const room = this.joined(client);
    if (!parsed || !room) {
      return;
    }
    if (!this.boardFor(room.bookingId).addPoints(room.userId, parsed.id, parsed.points)) {
      return;
    }
    client.to(classroomRoom(room.bookingId)).emit('whiteboard-points', parsed);
  }

  @SubscribeMessage('whiteboard-end')
  whiteboardEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): void {
    const id = parseEnd(body);
    const room = this.joined(client);
    if (!id || !room) {
      return;
    }
    if (!this.boardFor(room.bookingId).end(room.userId, id)) {
      return;
    }
    client.to(classroomRoom(room.bookingId)).emit('whiteboard-end', { id });
  }

  @SubscribeMessage('whiteboard-clear')
  whiteboardClear(@ConnectedSocket() client: Socket): void {
    const room = this.joined(client);
    if (!room) {
      return;
    }
    this.boardFor(room.bookingId).clear();
    client.to(classroomRoom(room.bookingId)).emit('whiteboard-clear');
  }

  private relay(
    client: Socket,
    event: 'offer' | 'answer' | 'ice-candidate',
    payload: SignalBody,
  ): void {
    const bookingId = clientData(client).bookingId;
    const value = event === 'ice-candidate' ? payload.candidate : payload.sdp;
    if (!bookingId || value == null) {
      return;
    }
    client.to(classroomRoom(bookingId)).emit(event, payload);
  }

  private joined(client: Socket): { userId: string; bookingId: string } | null {
    const data = clientData(client);
    if (!data.userId || !data.bookingId) {
      return null;
    }
    return { userId: data.userId, bookingId: data.bookingId };
  }

  private boardFor(bookingId: string): RoomBoard {
    let board = this.boards.get(bookingId);
    if (!board) {
      board = new RoomBoard();
      this.boards.set(bookingId, board);
    }
    return board;
  }

  private async dropBoardIfEmpty(bookingId: string): Promise<void> {
    if (!this.server) {
      return;
    }
    const sockets = await this.server.in(classroomRoom(bookingId)).fetchSockets();
    if (sockets.length === 0) {
      this.boards.delete(bookingId);
    }
  }
}

function clientData(client: Socket): ClientData {
  return client.data as ClientData;
}
