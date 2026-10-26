
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_events": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"family_id": string,"id": number,"subject_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"family_id": string,"id"?: never,"subject_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"family_id"?: string,"id"?: never,"subject_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_events_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"care_records": {
                  Row: {
                    "amount_g": number | null,"amount_ml": number | null,"child_id": string,"created_at": string,"created_by": string | null,"ended_at": string | null,"food_name": string,"id": string,"kind": string,"note": string,"record_timezone": string | null,"started_at": string,"updated_at": string,"updated_by": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_g"?: number | null,"amount_ml"?: number | null,"child_id": string,"created_at"?: string,"created_by"?: string | null,"ended_at"?: string | null,"food_name"?: string,"id": string,"kind": string,"note"?: string,"record_timezone"?: string | null,"started_at": string,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Update: {
                    "amount_g"?: number | null,"amount_ml"?: number | null,"child_id"?: string,"created_at"?: string,"created_by"?: string | null,"ended_at"?: string | null,"food_name"?: string,"id"?: string,"kind"?: string,"note"?: string,"record_timezone"?: string | null,"started_at"?: string,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "care_records_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "care_records_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "care_records_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"child_access": {
                  Row: {
                    "child_id": string,"family_id": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"family_id": string,"role": string,"user_id": string
                  }
                  Update: {
                    "child_id"?: string,"family_id"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "child_access_child_id_family_id_fkey"
      columns: ["child_id","family_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "child_access_family_id_user_id_fkey"
      columns: ["family_id","user_id"]
isOneToOne: false
      referencedRelation: "family_members"
      referencedColumns: ["family_id","user_id"]
    }
                  ]
                },"child_meal_plans": {
                  Row: {
                    "child_id": string,"feeding_minutes": number | null,"solids_times": (string)[],"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"feeding_minutes"?: number | null,"solids_times"?: (string)[],"timezone": string
                  }
                  Update: {
                    "child_id"?: string,"feeding_minutes"?: number | null,"solids_times"?: (string)[],"timezone"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "child_meal_plans_child_id_fkey"
      columns: ["child_id"]
isOneToOne: true
      referencedRelation: "children"
      referencedColumns: ["id"]
    }
                  ]
                },"child_photo_cleanup": {
                  Row: {
                    "path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "path": string
                  }
                  Update: {
                    "path"?: string
                  }
                  Relationships: [
                    
                  ]
                },"child_record_photos": {
                  Row: {
                    "child_id": string,"content_type": string,"created_at": string,"id": string,"path": string,"record_id": string,"size_bytes": number,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"content_type": string,"created_at"?: string,"id": string,"path": string,"record_id": string,"size_bytes": number,"uploaded_by": string
                  }
                  Update: {
                    "child_id"?: string,"content_type"?: string,"created_at"?: string,"id"?: string,"path"?: string,"record_id"?: string,"size_bytes"?: number,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "child_record_photos_record_id_child_id_fkey"
      columns: ["record_id","child_id"]
isOneToOne: false
      referencedRelation: "child_records"
      referencedColumns: ["id","child_id"]
    },{
      foreignKeyName: "child_record_photos_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"child_records": {
                  Row: {
                    "child_id": string,"created_at": string,"created_by": string | null,"dose_amount": number | null,"dose_unit": string | null,"duration_minutes": number | null,"ended_at": string | null,"head_cm": number | null,"height_cm": number | null,"id": string,"kind": string,"medicine_name": string,"note": string,"occurred_at": string,"record_timezone": string,"service": string,"stool_color": string | null,"stool_texture": string | null,"temperature_c": number | null,"title": string,"updated_at": string,"updated_by": string | null,"version": number,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"created_at"?: string,"created_by"?: string | null,"dose_amount"?: number | null,"dose_unit"?: string | null,"duration_minutes"?: number | null,"ended_at"?: string | null,"head_cm"?: number | null,"height_cm"?: number | null,"id": string,"kind": string,"medicine_name"?: string,"note"?: string,"occurred_at": string,"record_timezone": string,"service": string,"stool_color"?: string | null,"stool_texture"?: string | null,"temperature_c"?: number | null,"title"?: string,"updated_at"?: string,"updated_by"?: string | null,"version"?: number,"weight_kg"?: number | null
                  }
                  Update: {
                    "child_id"?: string,"created_at"?: string,"created_by"?: string | null,"dose_amount"?: number | null,"dose_unit"?: string | null,"duration_minutes"?: number | null,"ended_at"?: string | null,"head_cm"?: number | null,"height_cm"?: number | null,"id"?: string,"kind"?: string,"medicine_name"?: string,"note"?: string,"occurred_at"?: string,"record_timezone"?: string,"service"?: string,"stool_color"?: string | null,"stool_texture"?: string | null,"temperature_c"?: number | null,"title"?: string,"updated_at"?: string,"updated_by"?: string | null,"version"?: number,"weight_kg"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "child_records_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "child_records_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "child_records_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"children": {
                  Row: {
                    "birth_date": string | null,"created_at": string,"due_date": string | null,"family_id": string,"id": string,"name": string,"sex": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "birth_date"?: string | null,"created_at"?: string,"due_date"?: string | null,"family_id": string,"id"?: string,"name": string,"sex"?: string | null
                  }
                  Update: {
                    "birth_date"?: string | null,"created_at"?: string,"due_date"?: string | null,"family_id"?: string,"id"?: string,"name"?: string,"sex"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "children_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"community_blocks": {
                  Row: {
                    "blocked_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_id": string,"user_id": string
                  }
                  Update: {
                    "blocked_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "community_blocks_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"community_boards": {
                  Row: {
                    "country_code": string,"id": string,"region_code": string | null,"region_label": string,"scope": string,"topic": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "country_code": string,"id"?: string,"region_code"?: string | null,"region_label": string,"scope": string,"topic"?: string | null
                  }
                  Update: {
                    "country_code"?: string,"id"?: string,"region_code"?: string | null,"region_label"?: string,"scope"?: string,"topic"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_boards_country_code_fkey"
      columns: ["country_code"]
isOneToOne: false
      referencedRelation: "residence_countries"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "community_boards_country_code_region_code_fkey"
      columns: ["country_code","region_code"]
isOneToOne: false
      referencedRelation: "residence_regions"
      referencedColumns: ["country_code","code"]
    }
                  ]
                },"community_bookmarks": {
                  Row: {
                    "post_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "post_id": string,"user_id": string
                  }
                  Update: {
                    "post_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_bookmarks_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "community_posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "community_bookmarks_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"community_comments": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"hidden": boolean,"id": string,"post_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"hidden"?: boolean,"id": string,"post_id": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"hidden"?: boolean,"id"?: string,"post_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "community_comments_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "community_posts"
      referencedColumns: ["id"]
    }
                  ]
                },"community_moderators": {
                  Row: {
                    "user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "user_id": string
                  }
                  Update: {
                    "user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_moderators_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"community_photo_cleanup": {
                  Row: {
                    "path": string,"queued_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "path": string,"queued_at"?: string
                  }
                  Update: {
                    "path"?: string,"queued_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"community_photos": {
                  Row: {
                    "content_type": string,"created_at": string,"id": string,"owner_id": string,"path": string,"post_id": string,"size_bytes": number
                  }
                  ComputedFields: never
                  Insert: {
                    "content_type": string,"created_at"?: string,"id": string,"owner_id": string,"path": string,"post_id": string,"size_bytes": number
                  }
                  Update: {
                    "content_type"?: string,"created_at"?: string,"id"?: string,"owner_id"?: string,"path"?: string,"post_id"?: string,"size_bytes"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_photos_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "community_photos_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "community_posts"
      referencedColumns: ["id"]
    }
                  ]
                },"community_posts": {
                  Row: {
                    "author_id": string,"board_id": string,"body": string,"created_at": string,"hidden": boolean,"id": string,"notice": boolean,"region": string,"title": string,"topic": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"board_id": string,"body": string,"created_at"?: string,"hidden"?: boolean,"id": string,"notice"?: boolean,"region": string,"title": string,"topic": string,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string,"board_id"?: string,"body"?: string,"created_at"?: string,"hidden"?: boolean,"id"?: string,"notice"?: boolean,"region"?: string,"title"?: string,"topic"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_posts_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "community_posts_board_id_fkey"
      columns: ["board_id"]
isOneToOne: false
      referencedRelation: "community_boards"
      referencedColumns: ["id"]
    }
                  ]
                },"community_reactions": {
                  Row: {
                    "post_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "post_id": string,"user_id": string
                  }
                  Update: {
                    "post_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_reactions_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "community_posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "community_reactions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"community_reports": {
                  Row: {
                    "comment_id": string | null,"created_at": string,"diary_nickname": string | null,"diary_note": string | null,"diary_record_id": string | null,"id": string,"post_id": string | null,"reason": string,"reporter_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comment_id"?: string | null,"created_at"?: string,"diary_nickname"?: string | null,"diary_note"?: string | null,"diary_record_id"?: string | null,"id"?: string,"post_id"?: string | null,"reason": string,"reporter_id": string,"status"?: string
                  }
                  Update: {
                    "comment_id"?: string | null,"created_at"?: string,"diary_nickname"?: string | null,"diary_note"?: string | null,"diary_record_id"?: string | null,"id"?: string,"post_id"?: string | null,"reason"?: string,"reporter_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_reports_comment_id_fkey"
      columns: ["comment_id"]
isOneToOne: false
      referencedRelation: "community_comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "community_reports_diary_record_id_fkey"
      columns: ["diary_record_id"]
isOneToOne: false
      referencedRelation: "child_records"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "community_reports_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "community_posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "community_reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"community_restrictions": {
                  Row: {
                    "reason": string,"until_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "reason": string,"until_at": string,"user_id": string
                  }
                  Update: {
                    "reason"?: string,"until_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_restrictions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"content_items": {
                  Row: {
                    "country": string,"effective_date": string | null,"key": string,"last_reviewed_at": string | null,"region": string,"reviewer": string | null,"service": string,"source_url": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "country"?: string,"effective_date"?: string | null,"key": string,"last_reviewed_at"?: string | null,"region"?: string,"reviewer"?: string | null,"service": string,"source_url"?: string | null,"status"?: string
                  }
                  Update: {
                    "country"?: string,"effective_date"?: string | null,"key"?: string,"last_reviewed_at"?: string | null,"region"?: string,"reviewer"?: string | null,"service"?: string,"source_url"?: string | null,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"content_translations": {
                  Row: {
                    "body": string,"content_key": string,"locale": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"content_key": string,"locale": string,"title": string
                  }
                  Update: {
                    "body"?: string,"content_key"?: string,"locale"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_translations_content_key_fkey"
      columns: ["content_key"]
isOneToOne: false
      referencedRelation: "content_items"
      referencedColumns: ["key"]
    }
                  ]
                },"daily_poll_votes": {
                  Row: {
                    "option_index": number,"poll_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "option_index": number,"poll_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "option_index"?: number,"poll_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_poll_votes_poll_id_fkey"
      columns: ["poll_id"]
isOneToOne: false
      referencedRelation: "daily_polls"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "daily_poll_votes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"daily_polls": {
                  Row: {
                    "closes_at": string | null,"created_at": string,"day": string,"hidden": boolean,"id": string,"opens_at": string | null,"options": NonNullable<Json>,"question_en": string,"question_ko": string
                  }
                  ComputedFields: never
                  Insert: {
                    "closes_at"?: never,"created_at"?: string,"day": string,"hidden"?: boolean,"id"?: string,"opens_at"?: never,"options": NonNullable<Json>,"question_en": string,"question_ko": string
                  }
                  Update: {
                    "closes_at"?: never,"created_at"?: string,"day"?: string,"hidden"?: boolean,"id"?: string,"opens_at"?: never,"options"?: NonNullable<Json>,"question_en"?: string,"question_ko"?: string
                  }
                  Relationships: [
                    
                  ]
                },"data_deletion_permits": {
                  Row: {
                    "expires_at": string,"token": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "expires_at"?: string,"token"?: string,"user_id": string
                  }
                  Update: {
                    "expires_at"?: string,"token"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"data_operation_history": {
                  Row: {
                    "created_at": string,"id": number,"job_id": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"job_id"?: string | null,"status": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"job_id"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "data_operation_history_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "data_operation_jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"data_operation_jobs": {
                  Row: {
                    "attempts": number,"completed_at": string | null,"created_at": string,"error_code": string | null,"id": string,"lease_token": string | null,"leased_until": string | null,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"completed_at"?: string | null,"created_at"?: string,"error_code"?: string | null,"id"?: string,"lease_token"?: string | null,"leased_until"?: string | null,"status"?: string,"user_id": string
                  }
                  Update: {
                    "attempts"?: number,"completed_at"?: string | null,"created_at"?: string,"error_code"?: string | null,"id"?: string,"lease_token"?: string | null,"leased_until"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"events": {
                  Row: {
                    "child_id": string,"created_by": string | null,"date": string,"event_kind": string,"event_time": string | null,"id": string,"note": string,"record_timezone": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"created_by"?: string | null,"date": string,"event_kind"?: string,"event_time"?: string | null,"id"?: string,"note"?: string,"record_timezone"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "child_id"?: string,"created_by"?: string | null,"date"?: string,"event_kind"?: string,"event_time"?: string | null,"id"?: string,"note"?: string,"record_timezone"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"families": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"residence_city": string | null,"residence_country_code": string | null,"residence_locality": string | null,"residence_region_code": string | null,"residence_updated_at": string | null,"residence_version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"residence_city"?: string | null,"residence_country_code"?: string | null,"residence_locality"?: string | null,"residence_region_code"?: string | null,"residence_updated_at"?: string | null,"residence_version"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"residence_city"?: string | null,"residence_country_code"?: string | null,"residence_locality"?: string | null,"residence_region_code"?: string | null,"residence_updated_at"?: string | null,"residence_version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_residence_region_fk"
      columns: ["residence_country_code","residence_region_code"]
isOneToOne: false
      referencedRelation: "residence_regions"
      referencedColumns: ["country_code","code"]
    }
                  ]
                },"family_members": {
                  Row: {
                    "family_id": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "family_id": string,"role": string,"user_id": string
                  }
                  Update: {
                    "family_id"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_members_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "family_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"growth_diary_shares": {
                  Row: {
                    "everyone": boolean,"hidden": boolean,"published_by": string,"record_id": string,"same_birth_date": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "everyone"?: boolean,"hidden"?: boolean,"published_by": string,"record_id": string,"same_birth_date"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "everyone"?: boolean,"hidden"?: boolean,"published_by"?: string,"record_id"?: string,"same_birth_date"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "growth_diary_shares_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "growth_diary_shares_record_id_fkey"
      columns: ["record_id"]
isOneToOne: true
      referencedRelation: "child_records"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"child_id": string,"created_by": string | null,"expires_at": string,"family_id": string,"id": string,"revoked_at": string | null,"role": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"child_id": string,"created_by"?: string | null,"expires_at"?: string,"family_id": string,"id"?: string,"revoked_at"?: string | null,"role": string,"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"child_id"?: string,"created_by"?: string | null,"expires_at"?: string,"family_id"?: string,"id"?: string,"revoked_at"?: string | null,"role"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_child_id_family_id_fkey"
      columns: ["child_id","family_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "invitations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"moderation_actions": {
                  Row: {
                    "action": string,"created_at": string,"id": number,"moderator_id": string | null,"reason": string,"subject_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"created_at"?: string,"id"?: never,"moderator_id"?: string | null,"reason": string,"subject_id": string
                  }
                  Update: {
                    "action"?: string,"created_at"?: string,"id"?: never,"moderator_id"?: string | null,"reason"?: string,"subject_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "moderation_actions_moderator_id_fkey"
      columns: ["moderator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_job_runs": {
                  Row: {
                    "attempts": number,"delivered_count": number,"error_code": string | null,"finished_at": string | null,"id": string,"recipient_id": string | null,"started_at": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"delivered_count"?: number,"error_code"?: string | null,"finished_at"?: string | null,"id"?: string,"recipient_id"?: string | null,"started_at"?: string,"status"?: string
                  }
                  Update: {
                    "attempts"?: number,"delivered_count"?: number,"error_code"?: string | null,"finished_at"?: string | null,"id"?: string,"recipient_id"?: string | null,"started_at"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_job_runs_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_preferences": {
                  Row: {
                    "delivery_hour": number,"event_enabled": boolean,"feeding_enabled": boolean,"feeding_interval_minutes": number,"frequency_minutes": number,"quiet_end": string,"quiet_start": string,"snooze_until": string | null,"task_enabled": boolean,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "delivery_hour"?: number,"event_enabled"?: boolean,"feeding_enabled"?: boolean,"feeding_interval_minutes"?: number,"frequency_minutes"?: number,"quiet_end"?: string,"quiet_start"?: string,"snooze_until"?: string | null,"task_enabled"?: boolean,"user_id": string
                  }
                  Update: {
                    "delivery_hour"?: number,"event_enabled"?: boolean,"feeding_enabled"?: boolean,"feeding_interval_minutes"?: number,"frequency_minutes"?: number,"quiet_end"?: string,"quiet_start"?: string,"snooze_until"?: string | null,"task_enabled"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "cancelled_at": string | null,"child_id": string,"dedupe_key": string,"delivered_at": string | null,"id": string,"kind": string,"read_at": string | null,"recipient_id": string,"reference_date": string | null,"reference_id": string,"scheduled_at": string,"notification_valid": boolean | null
                  }
                  ComputedFields: "notification_valid"
                  Insert: {
                    "cancelled_at"?: string | null,"child_id": string,"dedupe_key": string,"delivered_at"?: string | null,"id"?: string,"kind": string,"read_at"?: string | null,"recipient_id": string,"reference_date"?: string | null,"reference_id": string,"scheduled_at": string
                  }
                  Update: {
                    "cancelled_at"?: string | null,"child_id"?: string,"dedupe_key"?: string,"delivered_at"?: string | null,"id"?: string,"kind"?: string,"read_at"?: string | null,"recipient_id"?: string,"reference_date"?: string | null,"reference_id"?: string,"scheduled_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "consented_at": string | null,"created_at": string,"display_name": string,"id": string,"locale": string,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "consented_at"?: string | null,"created_at"?: string,"display_name"?: string,"id": string,"locale"?: string,"timezone"?: string
                  }
                  Update: {
                    "consented_at"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"locale"?: string,"timezone"?: string
                  }
                  Relationships: [
                    
                  ]
                },"residence_countries": {
                  Row: {
                    "code": string,"enabled": boolean,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"enabled"?: boolean,"name": string
                  }
                  Update: {
                    "code"?: string,"enabled"?: boolean,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"residence_regions": {
                  Row: {
                    "active": boolean,"city_name": string,"code": string,"community_scope": string | null,"country_code": string,"kind": string,"level": number,"locality_name": string,"parent_code": string | null,"parent_level": number | null,"selectable": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"city_name": string,"code": string,"community_scope"?: string | null,"country_code": string,"kind"?: string,"level"?: number,"locality_name": string,"parent_code"?: string | null,"parent_level"?: number | null,"selectable"?: boolean
                  }
                  Update: {
                    "active"?: boolean,"city_name"?: string,"code"?: string,"community_scope"?: string | null,"country_code"?: string,"kind"?: string,"level"?: number,"locality_name"?: string,"parent_code"?: string | null,"parent_level"?: number | null,"selectable"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "residence_regions_country_fk"
      columns: ["country_code"]
isOneToOne: false
      referencedRelation: "residence_countries"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "residence_regions_parent_fk"
      columns: ["country_code","parent_code","parent_level"]
isOneToOne: false
      referencedRelation: "residence_regions"
      referencedColumns: ["country_code","code","level"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "anchor": string | null,"assignee_id": string | null,"child_id": string,"created_by": string | null,"due_date": string | null,"id": string,"offset_days": number | null,"service": string,"source": string,"status": string,"template_key": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anchor"?: string | null,"assignee_id"?: string | null,"child_id": string,"created_by"?: string | null,"due_date"?: string | null,"id"?: string,"offset_days"?: number | null,"service": string,"source"?: string,"status"?: string,"template_key"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "anchor"?: string | null,"assignee_id"?: string | null,"child_id"?: string,"created_by"?: string | null,"due_date"?: string | null,"id"?: string,"offset_days"?: number | null,"service"?: string,"source"?: string,"status"?: string,"template_key"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"usage_events": {
                  Row: {
                    "family_id": string | null,"id": number,"kind": string,"occurred_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "family_id"?: string | null,"id"?: never,"kind": string,"occurred_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "family_id"?: string | null,"id"?: never,"kind"?: string,"occurred_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "usage_events_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "usage_events_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"vaccination_records": {
                  Row: {
                    "child_id": string,"clinic": string,"completed_date": string | null,"created_at": string,"created_by": string | null,"custom_name": string,"dose": number | null,"id": string,"note": string,"record_timezone": string,"scheduled_date": string | null,"season": string | null,"status": string,"updated_at": string,"updated_by": string | null,"vaccine": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"clinic"?: string,"completed_date"?: string | null,"created_at"?: string,"created_by"?: string | null,"custom_name"?: string,"dose"?: number | null,"id": string,"note"?: string,"record_timezone": string,"scheduled_date"?: string | null,"season"?: string | null,"status": string,"updated_at"?: string,"updated_by"?: string | null,"vaccine": string,"version"?: number
                  }
                  Update: {
                    "child_id"?: string,"clinic"?: string,"completed_date"?: string | null,"created_at"?: string,"created_by"?: string | null,"custom_name"?: string,"dose"?: number | null,"id"?: string,"note"?: string,"record_timezone"?: string,"scheduled_date"?: string | null,"season"?: string | null,"status"?: string,"updated_at"?: string,"updated_by"?: string | null,"vaccine"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "vaccination_records_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vaccination_records_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vaccination_records_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "calendar_entries": {
                  Row: {
                    "child_id": string | null,"clinic": string | null,"custom_name": string | null,"date": string | null,"event_kind": string | null,"event_time": string | null,"id": string | null,"note": string | null,"record_timezone": string | null,"source": string | null,"status": string | null,"title": string | null,"vaccine": string | null
                  }
                  ComputedFields: never
                  Relationships: [

                  ]
                }
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_token": string }; Returns: string
                           },
"account_active":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"account_has_storage":
{ Args: { "p_user": string }; Returns: boolean
                           },
"add_child_record_photo":
{ Args: { "p_id": string,"p_record": string,"p_size": number,"p_type": string }; Returns: string
                           },
"add_preparation_tasks":
{ Args: { "p_child_id": string,"p_locale": string }; Returns: undefined
                           },
"can_read_child":
{ Args: { "cid": string }; Returns: boolean
                           },
"can_write_child":
{ Args: { "cid": string }; Returns: boolean
                           },
"child_photo_access":
{ Args: { "p_path": string,"p_upload": boolean }; Returns: boolean
                           },
"child_record_day_count":
{ Args: { "p_child": string,"p_day": string,"p_service": string,"p_timezone": string }; Returns: number
                           },
"claim_data_operation":
{ Args: Record<PropertyKey, never>; Returns: {
              "attempts": number,
"completed_at": string | null,
"created_at": string,
"error_code": string | null,
"id": string,
"lease_token": string | null,
"leased_until": string | null,
"status": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "data_operation_jobs"
        isOneToOne: true
        isSetofReturn: false
      } },
"community_author_visible":
{ Args: { "p_author": string }; Returns: boolean
                           },
"community_board_locations":
{ Args: Record<PropertyKey, never>; Returns: {
              "country_code": string,"country_name": string,"family_id": string,"region_code": string,"region_name": string,"scope": string
            }[]
                           },
"community_board_visible":
{ Args: { "p_board": string }; Returns: boolean
                           },
"community_can_write":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"community_command":
{ Args: { "p_action": string,"p_data": Json,"p_id": string }; Returns: undefined
                           },
"community_comment_visible":
{ Args: { "p_id": string }; Returns: boolean
                           },
"community_participant":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"community_photo_upload_allowed":
{ Args: { "p_path": string }; Returns: boolean
                           },
"community_post_visible":
{ Args: { "p_id": string }; Returns: boolean
                           },
"create_family_with_child":
{ Args: { "p_birth_date": string,"p_child_name": string,"p_due_date": string,"p_family_name": string }; Returns: string
                           },
"create_invitation":
{ Args: { "p_child_id": string,"p_role": string }; Returns: string
                           },
"daily_poll_visible":
{ Args: { "p_id": string }; Returns: boolean
                           },
"delete_calendar_item":
{ Args: { "p_id": string,"p_kind": string }; Returns: undefined
                           },
"delete_care_record":
{ Args: { "p_id": string }; Returns: undefined
                           },
"delete_child_data":
{ Args: { "p_child": string,"p_confirmation": string }; Returns: undefined
                           },
"delete_child_record":
{ Args: { "p_id": string }; Returns: undefined
                           },
"delete_vaccination_record":
{ Args: { "p_id": string }; Returns: undefined
                           },
"deliver_notifications_internal":
{ Args: { "p_user": string }; Returns: number
                           },
"export_child_data":
{ Args: { "p_child": string }; Returns: Json
                           },
"finish_data_operation":
{ Args: { "p_job": string,"p_lease": string,"p_success": boolean }; Returns: undefined
                           },
"growth_diary_cohort_visible":
{ Args: { "p_child": string,"p_record": string }; Returns: boolean
                           },
"growth_diary_feed":
{ Args: { "p_age"?: number,"p_child": string,"p_page"?: number,"p_scope": string }; Returns: {
              "age_days": number,"head_cm": number,"height_cm": number,"id": string,"nickname": string,"note": string,"photo_ids": (string)[],"sex": string,"weight_kg": number
            }[]
                           },
"growth_diary_history":
{ Args: { "p_child": string,"p_page"?: number,"p_record": string }; Returns: {
              "age_days": number,"head_cm": number,"height_cm": number,"id": string,"weight_kg": number
            }[]
                           },
"growth_diary_photo":
{ Args: { "p_id": string }; Returns: {
              "content_type": string,"path": string
            }[]
                           },
"growth_diary_photo_allowed":
{ Args: { "p_record": string }; Returns: boolean
                           },
"growth_diary_photo_by_path":
{ Args: { "p_path": string }; Returns: boolean
                           },
"hide_daily_poll":
{ Args: { "p_hidden": boolean,"p_id": string,"p_reason": string }; Returns: undefined
                           },
"is_family_member":
{ Args: { "fid": string }; Returns: boolean
                           },
"is_family_owner":
{ Args: { "fid": string }; Returns: boolean
                           },
"is_moderator":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"list_caregivers":
{ Args: { "p_child_id": string }; Returns: {
              "display_name": string,"role": string,"user_id": string
            }[]
                           },
"moderate_growth_diary":
{ Args: { "p_hidden": boolean,"p_reason": string,"p_record": string }; Returns: undefined
                           },
"notification_child_access":
{ Args: { "p_child": string,"p_user": string }; Returns: boolean
                           },
"notification_quiet":
{ Args: { "p_end": string,"p_local": string,"p_start": string }; Returns: boolean
                           },
"notification_run_one":
{ Args: { "p_retry"?: string,"p_user": string }; Returns: undefined
                           },
"notification_valid":
{ Args: { "p_notification": Omit<Database["public"]['Tables']["notifications"]['Row'], Database["public"]['Tables']["notifications"]['ComputedFields']> }; Returns: boolean
                           },
"notification_visible":
{ Args: { "p_id": string }; Returns: boolean
                           },
"operation_metrics":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"permit_account_deletion":
{ Args: { "p_user": string }; Returns: string
                           },
"poll_results":
{ Args: { "p_id": string }; Returns: Json
                           },
"preview_child_dates":
{ Args: { "p_birth_date": string,"p_child_id": string,"p_due_date": string }; Returns: {
              "current_due_date": string,"proposed_date": string,"task_id": string,"title": string
            }[]
                           },
"queue_orphan_photos":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"read_notification":
{ Args: { "p_id": string }; Returns: undefined
                           },
"remove_child_record_photo":
{ Args: { "p_id": string }; Returns: undefined
                           },
"report_growth_diary":
{ Args: { "p_child": string,"p_reason": string,"p_record": string }; Returns: undefined
                           },
"request_account_deletion":
{ Args: { "p_confirmation": string,"p_permit": string }; Returns: string
                           },
"require_recent_login":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"retry_data_operation":
{ Args: { "p_job": string }; Returns: undefined
                           },
"retry_notification_job":
{ Args: { "p_id": string }; Returns: undefined
                           },
"revoke_invitation":
{ Args: { "p_id": string }; Returns: undefined
                           },
"revoke_member":
{ Args: { "p_family_id": string,"p_user_id": string }; Returns: undefined
                           },
"run_notification_jobs":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"save_calendar_event":
{ Args: { "p_child_id": string,"p_date": string,"p_event_kind"?: string,"p_event_time"?: string,"p_event_timezone"?: string,"p_id": string,"p_note": string,"p_title": string }; Returns: string
                           },
"save_care_record":
{ Args: { "p_amount_ml": number,"p_child_id": string,"p_ended_at": string,"p_id": string,"p_kind": string,"p_note": string,"p_started_at": string,"p_version"?: number }; Returns: string
                           },
"save_child_record":
{ Args: { "p_child": string,"p_data": Json,"p_id": string,"p_service": string,"p_version"?: number }; Returns: string
                           },
"save_daily_poll":
{ Args: { "p_day": string,"p_id": string,"p_options": Json,"p_question_en": string,"p_question_ko": string }; Returns: string
                           },
"save_event":
{ Args: { "p_child_id": string,"p_date": string,"p_id": string,"p_note": string,"p_title": string }; Returns: string
                           },
"save_family_residence_region":
{ Args: { "p_country_code"?: string,"p_family": string,"p_region_code": string,"p_version": number }; Returns: undefined
                           },
"save_feeding_record":
{ Args: { "p_amount_g": number,"p_amount_ml": number,"p_child_id": string,"p_ended_at": string,"p_food_name": string,"p_id": string,"p_kind": string,"p_note": string,"p_started_at": string,"p_timezone": string,"p_version"?: number }; Returns: string
                           },
"save_notification_preferences":
{ Args: { "p_event": boolean,"p_feeding": boolean,"p_frequency": number,"p_hour": number,"p_interval": number,"p_quiet_end": string,"p_quiet_start": string,"p_snooze_minutes"?: number,"p_task": boolean }; Returns: undefined
                           },
"save_task":
{ Args: { "p_assignee_id": string,"p_child_id": string,"p_due_date": string,"p_id": string,"p_service": string,"p_status": string,"p_title": string }; Returns: string
                           },
"save_vaccination_record":
{ Args: { "p_child": string,"p_data": Json,"p_id": string,"p_version"?: number }; Returns: string
                           },
"share_growth_diary":
{ Args: { "p_everyone": boolean,"p_record": string,"p_same_birth_date": boolean,"p_sex": string }; Returns: undefined
                           },
"sync_notifications":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"transfer_family_ownership":
{ Args: { "p_confirmation": string,"p_family": string,"p_member": string }; Returns: undefined
                           },
"update_child_dates":
{ Args: { "p_birth_date": string,"p_child_id": string,"p_due_date": string }; Returns: undefined
                           },
"valid_meal_times":
{ Args: { "times": (string)[] }; Returns: boolean
                           },
"vote_daily_poll":
{ Args: { "p_id": string,"p_option": number }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
