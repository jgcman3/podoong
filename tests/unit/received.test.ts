import {describe,it,expect} from 'vitest';
import {receivedMoney} from '@/features/received/model';
describe('received money display',()=>{
 it('preserves exact aggregate cents beyond JavaScript safe integer range',()=>{
  expect(receivedMoney('9007199254740993.25','USD','en')).toContain('9,007,199,254,740,993.25');
 });
 it('keeps whole currency totals compact',()=>{
  expect(receivedMoney('10000','KRW','ko')).toContain('10,000');
  expect(receivedMoney('10000','KRW','ko')).not.toContain('.00');
 });
});
