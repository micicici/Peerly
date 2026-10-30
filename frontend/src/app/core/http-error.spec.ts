import { HttpErrorResponse } from '@angular/common/http';
import { failureOf } from './http-error';

describe('failureOf', () => {
  it('uses validation messages from a 400 body instead of FORBIDDEN', () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: {
        code: 'FORBIDDEN',
        message: ['Email format is invalid', 'Name is required'],
      },
    });

    expect(failureOf(err)).toEqual({
      errorCode: 'FORBIDDEN',
      message: 'Email format is invalid, Name is required',
    });
  });

  it('uses a single 409 validation message from the backend', () => {
    const err = new HttpErrorResponse({
      status: 409,
      error: {
        code: 'FORBIDDEN',
        message: 'Email format is invalid',
      },
    });

    expect(failureOf(err).message).toBe('Email format is invalid');
  });

  it('reads class-validator constraint text on a 400 response', () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: {
        message: [
          {
            property: 'email',
            constraints: { isEmail: 'Email format is invalid' },
          },
        ],
      },
    });

    expect(failureOf(err).message).toBe('Email format is invalid');
  });

  it('keeps a specific 403 message', () => {
    const err = new HttpErrorResponse({
      status: 403,
      error: {
        code: 'FORBIDDEN',
        message: 'You must keep at least one offering.',
      },
    });

    expect(failureOf(err).message).toBe('You must keep at least one offering.');
  });
});
