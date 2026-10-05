import { AppError } from '../common/app-error';
import { ClassroomAccess } from '../bookings/bookings.service';
import { ClassroomGateway, classroomRoom } from './classroom.gateway';

function access(role: ClassroomAccess['role']): ClassroomAccess {
  return {
    bookingId: 'b1',
    role,
    startAt: new Date('2026-09-25T12:00:00.000Z'),
    endAt: new Date('2026-09-25T13:00:00.000Z'),
    peerName: 'Ada',
    offeringTitle: 'Guitar',
  };
}

describe('ClassroomGateway', () => {
  it('names the signaling room after the booking', () => {
    expect(classroomRoom('b1')).toBe('booking:b1');
  });

  it('refuses a user who is not on the booking', async () => {
    const bookings = {
      classroomAccess: jest
        .fn()
        .mockRejectedValue(
          new AppError('FORBIDDEN', 'You are not in this class', 403),
        ),
    };
    const gateway = new ClassroomGateway(bookings as never, {} as never);
    const emit = jest.fn();
    await gateway.join(
      { data: { userId: 'stranger' }, emit } as never,
      { bookingId: 'b1' },
    );
    expect(bookings.classroomAccess).toHaveBeenCalledWith('stranger', 'b1');
    expect(emit).toHaveBeenCalledWith('classroom-error', {
      code: 'FORBIDDEN',
      message: 'You are not in this class',
    });
  });

  it('joins the teacher and asks them to offer when the student is already there', async () => {
    const bookings = {
      classroomAccess: jest.fn().mockResolvedValue(access('teacher')),
    };
    const gateway = new ClassroomGateway(bookings as never, {} as never);
    const peerEmit = jest.fn();
    const join = jest.fn().mockResolvedValue(undefined);
    const emit = jest.fn();
    gateway.server = {
      in: () => ({
        fetchSockets: async () => [
          { id: 'student-socket', data: { userId: 'student' } },
        ],
      }),
    } as never;
    await gateway.join(
      {
        id: 'teacher-socket',
        data: { userId: 'teacher' },
        emit,
        join,
        to: () => ({ emit: peerEmit }),
      } as never,
      { bookingId: 'b1' },
    );
    expect(join).toHaveBeenCalledWith('booking:b1');
    expect(emit).toHaveBeenCalledWith('joined', {
      role: 'teacher',
      peerName: 'Ada',
      peerPresent: true,
      shouldOffer: true,
    });
    expect(peerEmit).toHaveBeenCalledWith('peer-joined');
  });

  it('does not ask the student to create the offer', async () => {
    const bookings = {
      classroomAccess: jest.fn().mockResolvedValue(access('learner')),
    };
    const gateway = new ClassroomGateway(bookings as never, {} as never);
    const emit = jest.fn();
    gateway.server = {
      in: () => ({
        fetchSockets: async () => [
          { id: 'teacher-socket', data: { userId: 'teacher' } },
        ],
      }),
    } as never;
    await gateway.join(
      {
        id: 'student-socket',
        data: { userId: 'student' },
        emit,
        join: jest.fn().mockResolvedValue(undefined),
        to: () => ({ emit: jest.fn() }),
      } as never,
      { bookingId: 'b1' },
    );
    expect(emit).toHaveBeenCalledWith(
      'joined',
      expect.objectContaining({ role: 'learner', shouldOffer: false }),
    );
  });

  it('relays an offer only inside the joined room', () => {
    const gateway = new ClassroomGateway({} as never, {} as never);
    const emit = jest.fn();
    gateway.offer(
      {
        data: { bookingId: 'b1' },
        to: () => ({ emit }),
      } as never,
      { sdp: { type: 'offer', sdp: 'v=0' } },
    );
    expect(emit).toHaveBeenCalledWith('offer', {
      sdp: { type: 'offer', sdp: 'v=0' },
    });
  });

  it('ignores signaling before the socket has joined a class', () => {
    const gateway = new ClassroomGateway({} as never, {} as never);
    const emit = jest.fn();
    gateway.iceCandidate(
      { data: {}, to: () => ({ emit }) } as never,
      { candidate: { candidate: 'a=candidate' } },
    );
    expect(emit).not.toHaveBeenCalled();
  });

  it('relays a stroke inside the room and replays it for the next participant', async () => {
    const bookings = {
      classroomAccess: jest.fn().mockResolvedValue(access('learner')),
    };
    const gateway = new ClassroomGateway(bookings as never, {} as never);
    const peer = jest.fn();
    const teacher = {
      data: { userId: 'teacher', bookingId: 'b1' },
      to: () => ({ emit: peer }),
    };
    gateway.whiteboardBegin(teacher as never, {
      id: 'stroke-01',
      tool: 'pen',
      color: '#112233',
      size: 6,
    });
    gateway.whiteboardPoints(teacher as never, {
      id: 'stroke-01',
      points: [{ x: 0.2, y: 0.3 }],
    });
    expect(peer).toHaveBeenCalledWith('whiteboard-begin', {
      id: 'stroke-01',
      tool: 'pen',
      color: '#112233',
      size: 6,
    });
    expect(peer).toHaveBeenCalledWith('whiteboard-points', {
      id: 'stroke-01',
      points: [{ x: 0.2, y: 0.3 }],
    });

    const stranger = jest.fn();
    gateway.whiteboardPoints(
      {
        data: { userId: 'learner', bookingId: 'b1' },
        to: () => ({ emit: stranger }),
      } as never,
      { id: 'stroke-01', points: [{ x: 0.9, y: 0.9 }] },
    );
    expect(stranger).not.toHaveBeenCalled();

    const emit = jest.fn();
    gateway.server = {
      in: () => ({ fetchSockets: async () => [] }),
    } as never;
    await gateway.join(
      {
        id: 'learner-socket',
        data: { userId: 'learner' },
        emit,
        join: jest.fn().mockResolvedValue(undefined),
        to: () => ({ emit: jest.fn() }),
      } as never,
      { bookingId: 'b1' },
    );
    expect(emit).toHaveBeenCalledWith('whiteboard-snapshot', {
      strokes: [
        {
          id: 'stroke-01',
          tool: 'pen',
          color: '#112233',
          size: 6,
          points: [{ x: 0.2, y: 0.3 }],
        },
      ],
    });
  });

  it('clears the shared board for the other participant', () => {
    const gateway = new ClassroomGateway({} as never, {} as never);
    const peer = jest.fn();
    const client = {
      data: { userId: 'teacher', bookingId: 'b1' },
      to: () => ({ emit: peer }),
    };
    gateway.whiteboardBegin(client as never, {
      id: 'stroke-01',
      tool: 'pen',
      color: '#112233',
      size: 4,
    });
    gateway.whiteboardClear(client as never);
    expect(peer).toHaveBeenCalledWith('whiteboard-clear');
    peer.mockClear();
    gateway.whiteboardPoints(client as never, {
      id: 'stroke-01',
      points: [{ x: 0.1, y: 0.1 }],
    });
    expect(peer).not.toHaveBeenCalled();
  });

  it('ignores drawing before the socket has joined', () => {
    const gateway = new ClassroomGateway({} as never, {} as never);
    const emit = jest.fn();
    gateway.whiteboardBegin(
      { data: { userId: 'teacher' }, to: () => ({ emit }) } as never,
      { id: 'stroke-01', tool: 'pen', color: '#112233', size: 4 },
    );
    expect(emit).not.toHaveBeenCalled();
  });
});
