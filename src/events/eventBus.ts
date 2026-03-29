import { EventEmitter } from 'events';

export enum Events {
  ORDER_PLACED = 'ORDER_PLACED',
  ORDER_STATUS_UPDATED = 'ORDER_STATUS_UPDATED',
  ORDER_REVIEWED = 'ORDER_REVIEWED'
}

const eventBus = new EventEmitter();

export default eventBus;
