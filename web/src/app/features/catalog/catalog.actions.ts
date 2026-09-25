import { createActionGroup, props } from '@ngrx/store';
import { OfferingLevel } from '../offerings/offerings.actions';

export interface CatalogOffering {
  id: string;
  teacherId: string;
  teacherName: string;
  title: string;
  description: string;
  level: OfferingLevel;
  createdAt: string;
  openSlotCount: number;
  confirmedBookingCount: number;
}

export const CatalogActions = createActionGroup({
  source: 'Catalog',
  events: {
    Browse: props<{ q: string; level: OfferingLevel | '' }>(),
    'Browse Success': props<{ offerings: CatalogOffering[] }>(),
    'Browse Failure': props<{ errorCode: string; message: string }>(),
    'Load Detail': props<{ id: string }>(),
    'Load Detail Success': props<{ offering: CatalogOffering }>(),
    'Load Detail Failure': props<{ errorCode: string; message: string }>(),
  },
});
