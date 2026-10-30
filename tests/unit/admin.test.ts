import {describe,it,expect} from 'vitest';
import {adminCursor,errorInput,dashboardSchema,operationsSchema} from '@/features/admin/model';
const id='a5700000-0000-4000-8000-000000000001';
describe('admin data boundaries',()=>{
 it('accepts a complete cursor and drops malformed or partial cursors',()=>{
  expect(adminCursor({before:'2026-10-29T10:00:00Z',id})).toEqual({p_before:'2026-10-29T10:00:00Z',p_before_id:id});
  expect(adminCursor({before:'2026-10-29T10:00:00Z'})).toEqual({});
  expect(adminCursor({before:'not a timestamp',id})).toEqual({});
 });
 it('only forwards the error allowlist and never user-entered messages or URLs',()=>{
  const parsed=errorInput.parse({id,section:'today',code:'render_failed',digest:'12345',message:'PRIVATE_FORM_TEXT',url:'/share/diary/PRIVATE_TOKEN'});
  expect(JSON.stringify(parsed)).not.toContain('PRIVATE_');expect(parsed).toEqual({id,section:'today',code:'render_failed',digest:'12345'});
 });
 it.each([{section:'today',code:'PRIVATE_FORM_TEXT'},{section:'/share/secret',code:'render_failed'},{section:'today',code:'render_failed',digest:'a baby name'}])('rejects unsupported error content %j',input=>{
  expect(errorInput.safeParse({id,...input}).success).toBe(false);
 });
 it('does not replace unavailable snapshots with plausible fake totals',()=>{
  expect(dashboardSchema.safeParse({}).success).toBe(false);expect(operationsSchema.safeParse({push_devices:0}).success).toBe(false);
 });
});
