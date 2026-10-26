import type { Database as Generated } from './database.types';
// PostgreSQL parameters are nullable; codegen does not infer nullability from RPC bodies.
type NullableParameter =
  | 'p_age'
  | 'p_due_date'
  | 'p_birth_date'
  | 'p_ended_at'
  | 'p_amount_ml'
  | 'p_amount_g'
  | 'p_version'
  | 'p_assignee_id';
type Functions = {
  [F in keyof Generated['public']['Functions']]: Omit<
    Generated['public']['Functions'][F],
    'Args'
  > & {
    Args: {
      [
        K in keyof Generated['public']['Functions'][F]['Args']
      ]: K extends NullableParameter
        ? Generated['public']['Functions'][F]['Args'][K] | null
        : Generated['public']['Functions'][F]['Args'][K];
    };
  };
};
export type Database = Omit<Generated, 'public'> & {
  public: Omit<Generated['public'], 'Functions'> & { Functions: Functions };
};
export type Row<Table extends keyof Generated['public']['Tables']> =
  Generated['public']['Tables'][Table]['Row'];
