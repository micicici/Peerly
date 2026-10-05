import { createActionGroup, emptyProps, props } from '@ngrx/store';

export type OfferingLevel = 'beginner' | 'intermediate' | 'advanced';

export interface Offering {
  id: string;
  teacherId: string;
  title: string;
  description: string;
  level: OfferingLevel;
  createdAt: string;
  subjectId: string | null;
  subjectName: string | null;
}

export const OfferingsActions = createActionGroup({
  source: 'Offerings',
  events: {
    Create: props<{
      title: string;
      description: string;
      level: OfferingLevel;
      subjectName: string;
    }>(),
    'Create Success': props<{ offering: Offering }>(),
    'Create Failure': props<{ errorCode: string; message: string }>(),
    'Load Mine': emptyProps(),
    'Load Mine Success': props<{ offerings: Offering[] }>(),
    'Load Mine Failure': props<{ errorCode: string; message: string }>(),
    Update: props<{
      id: string;
      title: string;
      description: string;
      level: OfferingLevel;
      subjectName: string;
    }>(),
    'Update Success': props<{ offering: Offering }>(),
    'Update Failure': props<{ errorCode: string; message: string }>(),
    Remove: props<{ id: string }>(),
    'Remove Success': props<{ id: string }>(),
    'Remove Failure': props<{ errorCode: string; message: string }>(),
  },
});
