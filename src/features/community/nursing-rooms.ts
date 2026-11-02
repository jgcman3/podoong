import 'server-only';
import snapshot from './data/nursing-rooms.json';

export const nursingRooms = snapshot.rooms.map((room) => ({
  ...room,
  address: room.address.replace(/^서울시 /, '서울특별시 '),
}));

export function nursingRoomsInArea(area: string) {
  return area
    ? nursingRooms.filter((room) => room.address.startsWith(area + ' '))
    : [];
}
