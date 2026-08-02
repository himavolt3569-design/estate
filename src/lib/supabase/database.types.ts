export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agencies: {
        Row: {
          address_line: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string | null
          phone: string | null
          registration_number: string | null
          slug: string
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          address_line?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id?: string | null
          phone?: string | null
          registration_number?: string | null
          slug: string
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          address_line?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          registration_number?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agencies_owner_fk"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agencies_verified_by_fk"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          cancel_reason: string | null
          cancelled_by: string | null
          confirmed_slot: string | null
          created_at: string
          customer_id: string
          customer_note: string | null
          duration_min: number
          enquiry_id: string | null
          id: string
          property_id: string
          requested_slots: string[]
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
          vendor_id: string
          vendor_note: string | null
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_by?: string | null
          confirmed_slot?: string | null
          created_at?: string
          customer_id: string
          customer_note?: string | null
          duration_min?: number
          enquiry_id?: string | null
          id?: string
          property_id: string
          requested_slots: string[]
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          vendor_id: string
          vendor_note?: string | null
        }
        Update: {
          cancel_reason?: string | null
          cancelled_by?: string | null
          confirmed_slot?: string | null
          created_at?: string
          customer_id?: string
          customer_note?: string | null
          duration_min?: number
          enquiry_id?: string | null
          id?: string
          property_id?: string
          requested_slots?: string[]
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          vendor_id?: string
          vendor_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "enquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attribute_definitions: {
        Row: {
          applies_to: Database["public"]["Enums"]["property_subtype"][]
          display_group: string
          is_required: boolean
          key: string
          label_en: string
          label_ne: string | null
          max_value: number | null
          min_value: number | null
          options: string[] | null
          position: number
          unit: string | null
          value_type: Database["public"]["Enums"]["attribute_value_type"]
        }
        Insert: {
          applies_to: Database["public"]["Enums"]["property_subtype"][]
          display_group?: string
          is_required?: boolean
          key: string
          label_en: string
          label_ne?: string | null
          max_value?: number | null
          min_value?: number | null
          options?: string[] | null
          position?: number
          unit?: string | null
          value_type: Database["public"]["Enums"]["attribute_value_type"]
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["property_subtype"][]
          display_group?: string
          is_required?: boolean
          key?: string
          label_en?: string
          label_ne?: string | null
          max_value?: number | null
          min_value?: number | null
          options?: string[] | null
          position?: number
          unit?: string | null
          value_type?: Database["public"]["Enums"]["attribute_value_type"]
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["user_role"] | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          ip: unknown
          new_value: Json | null
          previous_value: Json | null
          request_id: string | null
          summary: string | null
          user_agent: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          ip?: unknown
          new_value?: Json | null
          previous_value?: Json | null
          request_id?: string | null
          summary?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          ip?: unknown
          new_value?: Json | null
          previous_value?: Json | null
          request_id?: string | null
          summary?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_logs_2026_07: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["user_role"] | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          ip: unknown
          new_value: Json | null
          previous_value: Json | null
          request_id: string | null
          summary: string | null
          user_agent: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          ip?: unknown
          new_value?: Json | null
          previous_value?: Json | null
          request_id?: string | null
          summary?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          ip?: unknown
          new_value?: Json | null
          previous_value?: Json | null
          request_id?: string | null
          summary?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_logs_2026_08: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["user_role"] | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          ip: unknown
          new_value: Json | null
          previous_value: Json | null
          request_id: string | null
          summary: string | null
          user_agent: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          ip?: unknown
          new_value?: Json | null
          previous_value?: Json | null
          request_id?: string | null
          summary?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          ip?: unknown
          new_value?: Json | null
          previous_value?: Json | null
          request_id?: string | null
          summary?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_logs_2026_09: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["user_role"] | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          ip: unknown
          new_value: Json | null
          previous_value: Json | null
          request_id: string | null
          summary: string | null
          user_agent: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          ip?: unknown
          new_value?: Json | null
          previous_value?: Json | null
          request_id?: string | null
          summary?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          ip?: unknown
          new_value?: Json | null
          previous_value?: Json | null
          request_id?: string | null
          summary?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      auth_events: {
        Row: {
          city: string | null
          country_code: string | null
          created_at: string
          detail: Json
          email_hash: string | null
          event: string
          id: number
          ip: unknown
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          city?: string | null
          country_code?: string | null
          created_at?: string
          detail?: Json
          email_hash?: string | null
          event: string
          id?: number
          ip?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          city?: string | null
          country_code?: string | null
          created_at?: string
          detail?: Json
          email_hash?: string | null
          event?: string
          id?: number
          ip?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_reveals: {
        Row: {
          channel: Database["public"]["Enums"]["contact_channel"]
          created_at: string
          id: number
          ip: unknown
          property_id: string
          subject: string
          user_id: string | null
        }
        Insert: {
          channel: Database["public"]["Enums"]["contact_channel"]
          created_at?: string
          id?: number
          ip?: unknown
          property_id: string
          subject: string
          user_id?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["contact_channel"]
          created_at?: string
          id?: number
          ip?: unknown
          property_id?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_reveals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_reveals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enquiries: {
        Row: {
          closed_at: string | null
          contact_email: string | null
          contact_name: string
          contact_phone: string | null
          created_at: string
          customer_id: string | null
          id: string
          message: string
          preferred_channel: Database["public"]["Enums"]["contact_channel"]
          property_id: string
          read_at: string | null
          replied_at: string | null
          source_ip: unknown
          status: Database["public"]["Enums"]["enquiry_status"]
          updated_at: string
          vendor_id: string
        }
        Insert: {
          closed_at?: string | null
          contact_email?: string | null
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          message: string
          preferred_channel?: Database["public"]["Enums"]["contact_channel"]
          property_id: string
          read_at?: string | null
          replied_at?: string | null
          source_ip?: unknown
          status?: Database["public"]["Enums"]["enquiry_status"]
          updated_at?: string
          vendor_id: string
        }
        Update: {
          closed_at?: string | null
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          message?: string
          preferred_channel?: Database["public"]["Enums"]["contact_channel"]
          property_id?: string
          read_at?: string | null
          replied_at?: string | null
          source_ip?: unknown
          status?: Database["public"]["Enums"]["enquiry_status"]
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enquiries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      features: {
        Row: {
          category: string
          icon: string | null
          id: string
          is_active: boolean
          key: string
          label_en: string
          label_ne: string | null
          position: number
        }
        Insert: {
          category?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          key: string
          label_en: string
          label_ne?: string | null
          position?: number
        }
        Update: {
          category?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          key?: string
          label_en?: string
          label_ne?: string | null
          position?: number
        }
        Relationships: []
      }
      locations: {
        Row: {
          bounds: unknown
          centroid: unknown
          created_at: string
          id: string
          is_active: boolean
          level: Database["public"]["Enums"]["location_level"]
          name_en: string
          name_ne: string | null
          parent_id: string | null
          path: unknown
          slug: string
          updated_at: string
        }
        Insert: {
          bounds?: unknown
          centroid?: unknown
          created_at?: string
          id?: string
          is_active?: boolean
          level: Database["public"]["Enums"]["location_level"]
          name_en: string
          name_ne?: string | null
          parent_id?: string | null
          path: unknown
          slug: string
          updated_at?: string
        }
        Update: {
          bounds?: unknown
          centroid?: unknown
          created_at?: string
          id?: string
          is_active?: boolean
          level?: Database["public"]["Enums"]["location_level"]
          name_en?: string
          name_ne?: string | null
          parent_id?: string | null
          path?: unknown
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          created_at: string
          created_by: string | null
          enquiry_id: string | null
          id: string
          property_id: string | null
          subject: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enquiry_id?: string | null
          id?: string
          property_id?: string | null
          subject?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enquiry_id?: string | null
          id?: string
          property_id?: string | null
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "enquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mfa_recovery_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          href: string | null
          id: string
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          href?: string | null
          id?: string
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          href?: string | null
          id?: string
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          account_name: string
          account_number: string
          bank_name: string | null
          branch: string | null
          created_at: string
          deleted_at: string | null
          id: string
          instructions: string | null
          is_active: boolean
          is_default: boolean
          owner_id: string
          provider: Database["public"]["Enums"]["payment_provider"]
          qr_image_path: string | null
          updated_at: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_name?: string | null
          branch?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          is_default?: boolean
          owner_id: string
          provider: Database["public"]["Enums"]["payment_provider"]
          qr_image_path?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_name?: string | null
          branch?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          is_default?: boolean
          owner_id?: string
          provider?: Database["public"]["Enums"]["payment_provider"]
          qr_image_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          payee_id: string
          payer_id: string
          payment_method_id: string | null
          proof_path: string
          property_id: string
          purpose: string
          reference: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          payee_id: string
          payer_id: string
          payment_method_id?: string | null
          proof_path: string
          property_id: string
          purpose?: string
          reference?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          payee_id?: string
          payer_id?: string
          payment_method_id?: string | null
          proof_path?: string
          property_id?: string
          purpose?: string
          reference?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_payee_id_fkey"
            columns: ["payee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string
          description: string
          key: string
        }
        Insert: {
          created_at?: string
          description: string
          key: string
        }
        Update: {
          created_at?: string
          description?: string
          key?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type_chosen_at: string | null
          agency_id: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          deleted_at: string | null
          full_name: string | null
          id: string
          identity_verified_at: string | null
          identity_verified_by: string | null
          last_seen_at: string | null
          phone: string | null
          preferred_area_unit: Database["public"]["Enums"]["area_unit"]
          preferred_locale: string
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["account_status"]
          suspended_at: string | null
          suspended_reason: string | null
          updated_at: string
        }
        Insert: {
          account_type_chosen_at?: string | null
          agency_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          deleted_at?: string | null
          full_name?: string | null
          id: string
          identity_verified_at?: string | null
          identity_verified_by?: string | null
          last_seen_at?: string | null
          phone?: string | null
          preferred_area_unit?: Database["public"]["Enums"]["area_unit"]
          preferred_locale?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["account_status"]
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string
        }
        Update: {
          account_type_chosen_at?: string | null
          agency_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          deleted_at?: string | null
          full_name?: string | null
          id?: string
          identity_verified_at?: string | null
          identity_verified_by?: string | null
          last_seen_at?: string | null
          phone?: string | null
          preferred_area_unit?: Database["public"]["Enums"]["area_unit"]
          preferred_locale?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["account_status"]
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_identity_verified_by_fkey"
            columns: ["identity_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address_line: string | null
          agency_id: string | null
          area_raw: Json
          area_sqm: number | null
          area_unit_entered: Database["public"]["Enums"]["area_unit"]
          bathrooms: number | null
          bedrooms: number | null
          built_area_sqm: number | null
          category: Database["public"]["Enums"]["property_category"]
          claimed_boundary: unknown
          created_at: string
          deleted_at: string | null
          description: string
          enquiry_count: number
          expires_at: string | null
          favorite_count: number
          feature_ids: string[]
          floors: number | null
          geom: unknown
          geom_precision: Database["public"]["Enums"]["geo_precision"]
          id: string
          listed_by_role: Database["public"]["Enums"]["user_role"]
          location_id: string
          owner_id: string
          parking: number | null
          price: number
          price_negotiable: boolean
          price_period: Database["public"]["Enums"]["price_period"] | null
          published_at: string | null
          reference_code: string
          rejection_reason: string | null
          road_access_ft: number | null
          search_vector: unknown
          service_charge: number | null
          show_email: boolean
          show_payment_info: boolean
          show_phone: boolean
          show_whatsapp: boolean
          slug: string
          status: Database["public"]["Enums"]["property_status"]
          subtype: Database["public"]["Enums"]["property_subtype"]
          title: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          view_count: number
        }
        Insert: {
          address_line?: string | null
          agency_id?: string | null
          area_raw?: Json
          area_sqm?: number | null
          area_unit_entered?: Database["public"]["Enums"]["area_unit"]
          bathrooms?: number | null
          bedrooms?: number | null
          built_area_sqm?: number | null
          category: Database["public"]["Enums"]["property_category"]
          claimed_boundary?: unknown
          created_at?: string
          deleted_at?: string | null
          description: string
          enquiry_count?: number
          expires_at?: string | null
          favorite_count?: number
          feature_ids?: string[]
          floors?: number | null
          geom: unknown
          geom_precision?: Database["public"]["Enums"]["geo_precision"]
          id?: string
          listed_by_role: Database["public"]["Enums"]["user_role"]
          location_id: string
          owner_id: string
          parking?: number | null
          price: number
          price_negotiable?: boolean
          price_period?: Database["public"]["Enums"]["price_period"] | null
          published_at?: string | null
          reference_code: string
          rejection_reason?: string | null
          road_access_ft?: number | null
          search_vector?: unknown
          service_charge?: number | null
          show_email?: boolean
          show_payment_info?: boolean
          show_phone?: boolean
          show_whatsapp?: boolean
          slug: string
          status?: Database["public"]["Enums"]["property_status"]
          subtype: Database["public"]["Enums"]["property_subtype"]
          title: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          view_count?: number
        }
        Update: {
          address_line?: string | null
          agency_id?: string | null
          area_raw?: Json
          area_sqm?: number | null
          area_unit_entered?: Database["public"]["Enums"]["area_unit"]
          bathrooms?: number | null
          bedrooms?: number | null
          built_area_sqm?: number | null
          category?: Database["public"]["Enums"]["property_category"]
          claimed_boundary?: unknown
          created_at?: string
          deleted_at?: string | null
          description?: string
          enquiry_count?: number
          expires_at?: string | null
          favorite_count?: number
          feature_ids?: string[]
          floors?: number | null
          geom?: unknown
          geom_precision?: Database["public"]["Enums"]["geo_precision"]
          id?: string
          listed_by_role?: Database["public"]["Enums"]["user_role"]
          location_id?: string
          owner_id?: string
          parking?: number | null
          price?: number
          price_negotiable?: boolean
          price_period?: Database["public"]["Enums"]["price_period"] | null
          published_at?: string | null
          reference_code?: string
          rejection_reason?: string | null
          road_access_ft?: number | null
          search_vector?: unknown
          service_charge?: number | null
          show_email?: boolean
          show_payment_info?: boolean
          show_phone?: boolean
          show_whatsapp?: boolean
          slug?: string
          status?: Database["public"]["Enums"]["property_status"]
          subtype?: Database["public"]["Enums"]["property_subtype"]
          title?: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "properties_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_attributes: {
        Row: {
          key: string
          property_id: string
          value_bool: boolean | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          key: string
          property_id: string
          value_bool?: boolean | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          key?: string
          property_id?: string
          value_bool?: boolean | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_attributes_key_fkey"
            columns: ["key"]
            isOneToOne: false
            referencedRelation: "attribute_definitions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "property_attributes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_documents: {
        Row: {
          bytes: number | null
          created_at: string
          file_name: string | null
          id: string
          is_public: boolean
          kind: Database["public"]["Enums"]["document_kind"]
          property_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          bytes?: number | null
          created_at?: string
          file_name?: string | null
          id?: string
          is_public?: boolean
          kind: Database["public"]["Enums"]["document_kind"]
          property_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          bytes?: number | null
          created_at?: string
          file_name?: string | null
          id?: string
          is_public?: boolean
          kind?: Database["public"]["Enums"]["document_kind"]
          property_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_contacts: {
        Row: {
          created_at: string
          id: string
          is_whatsapp: boolean
          label: string | null
          phone_e164: string
          position: number
          property_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_whatsapp?: boolean
          label?: string | null
          phone_e164: string
          position?: number
          property_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_whatsapp?: boolean
          label?: string | null
          phone_e164?: string
          position?: number
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_contacts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_features: {
        Row: {
          feature_id: string
          property_id: string
        }
        Insert: {
          feature_id: string
          property_id: string
        }
        Update: {
          feature_id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_features_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_images: {
        Row: {
          alt_text: string | null
          blurhash: string | null
          bytes: number | null
          created_at: string
          height: number | null
          id: string
          is_cover: boolean
          phash: string | null
          position: number
          property_id: string
          rendition_paths: Json
          storage_path: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          blurhash?: string | null
          bytes?: number | null
          created_at?: string
          height?: number | null
          id?: string
          is_cover?: boolean
          phash?: string | null
          position?: number
          property_id: string
          rendition_paths?: Json
          storage_path: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          blurhash?: string | null
          bytes?: number | null
          created_at?: string
          height?: number | null
          id?: string
          is_cover?: boolean
          phash?: string | null
          position?: number
          property_id?: string
          rendition_paths?: Json
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_videos: {
        Row: {
          created_at: string
          external_id: string | null
          id: string
          kind: Database["public"]["Enums"]["video_kind"]
          position: number
          property_id: string
          storage_path: string | null
          title: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["video_kind"]
          position?: number
          property_id: string
          storage_path?: string | null
          title?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          external_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["video_kind"]
          position?: number
          property_id?: string
          storage_path?: string | null
          title?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_videos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_views: {
        Row: {
          created_at: string
          id: number
          property_id: string
          referrer: string | null
          view_date: string
          viewer_hash: string
          viewer_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          property_id: string
          referrer?: string | null
          view_date?: string
          viewer_hash: string
          viewer_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          property_id?: string
          referrer?: string | null
          view_date?: string
          viewer_hash?: string
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_views_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_buckets: {
        Row: {
          bucket: string
          count: number
          subject: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          subject: string
          window_start: string
        }
        Update: {
          bucket?: string
          count?: number
          subject?: string
          window_start?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          assigned_to: string | null
          created_at: string
          detail: string | null
          due_at: string
          id: string
          reason: string
          reporter_id: string | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          detail?: string | null
          due_at?: string
          id?: string
          reason: string
          reporter_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          detail?: string | null
          due_at?: string
          id?: string
          reason?: string
          reporter_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          moderated_at: string | null
          moderated_by: string | null
          moderation_note: string | null
          property_id: string | null
          rating: number
          status: Database["public"]["Enums"]["review_status"]
          subject_id: string
          subject_type: string
          title: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          property_id?: string | null
          rating: number
          status?: Database["public"]["Enums"]["review_status"]
          subject_id: string
          subject_type: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          property_id?: string | null
          rating?: number
          status?: Database["public"]["Enums"]["review_status"]
          subject_id?: string
          subject_type?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_key: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          permission_key: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          permission_key?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string
          filters: Json
          frequency: string
          id: string
          last_match_at: string | null
          last_run_at: string | null
          name: string
          notify: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters: Json
          frequency?: string
          id?: string
          last_match_at?: string | null
          last_run_at?: string | null
          name: string
          notify?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          frequency?: string
          id?: string
          last_match_at?: string | null
          last_run_at?: string | null
          name?: string
          notify?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_health: {
        Row: {
          detail: Json
          id: number
          metric: string
          recorded_at: string
          unit: string | null
          value: number
        }
        Insert: {
          detail?: Json
          id?: number
          metric: string
          recorded_at?: string
          unit?: string | null
          value: number
        }
        Update: {
          detail?: Json
          id?: number
          metric?: string
          recorded_at?: string
          unit?: string | null
          value?: number
        }
        Relationships: []
      }
      thread_participants: {
        Row: {
          last_read_at: string | null
          thread_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string | null
          thread_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string | null
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trust_events: {
        Row: {
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["user_role"] | null
          created_at: string
          detail: Json
          event: Database["public"]["Enums"]["trust_event_type"]
          id: number
          property_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string
          detail?: Json
          event: Database["public"]["Enums"]["trust_event_type"]
          id?: number
          property_id: string
        }
        Update: {
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string
          detail?: Json
          event?: Database["public"]["Enums"]["trust_event_type"]
          id?: number
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trust_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trust_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          city: string | null
          country_code: string | null
          created_at: string
          device_label: string | null
          id: string
          ip: unknown
          last_seen_at: string
          revoked_at: string | null
          revoked_by: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          city?: string | null
          country_code?: string | null
          created_at?: string
          device_label?: string | null
          id?: string
          ip?: unknown
          last_seen_at?: string
          revoked_at?: string | null
          revoked_by?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          city?: string | null
          country_code?: string | null
          created_at?: string
          device_label?: string | null
          id?: string
          ip?: unknown
          last_seen_at?: string
          revoked_at?: string | null
          revoked_by?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_checks: {
        Row: {
          created_at: string
          detail: Json
          id: string
          kind: Database["public"]["Enums"]["check_kind"]
          passed: boolean
          property_id: string
          score: number | null
          source: string | null
          threshold: number | null
        }
        Insert: {
          created_at?: string
          detail?: Json
          id?: string
          kind: Database["public"]["Enums"]["check_kind"]
          passed: boolean
          property_id: string
          score?: number | null
          source?: string | null
          threshold?: number | null
        }
        Update: {
          created_at?: string
          detail?: Json
          id?: string
          kind?: Database["public"]["Enums"]["check_kind"]
          passed?: boolean
          property_id?: string
          score?: number | null
          source?: string | null
          threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_checks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_requests: {
        Row: {
          created_at: string
          decision_note: string | null
          document_ids: string[]
          id: string
          note: string | null
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["verification_status"]
          subject_id: string
          subject_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision_note?: string | null
          document_ids?: string[]
          id?: string
          note?: string | null
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          subject_id: string
          subject_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision_note?: string | null
          document_ids?: string[]
          id?: string
          note?: string | null
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          subject_id?: string
          subject_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_dashboard_stats: { Args: never; Returns: Json }
      admin_moderate_property: {
        Args: { p_decision: string; p_property_id: string; p_reason?: string }
        Returns: undefined
      }
      admin_resolve_report: {
        Args: {
          p_report_id: string
          p_resolution: string
          p_status: Database["public"]["Enums"]["report_status"]
        }
        Returns: undefined
      }
      admin_review_payment: {
        Args: { p_decision: string; p_payment_id: string; p_reason?: string }
        Returns: undefined
      }
      admin_set_property_verified: {
        Args: { p_property_id: string; p_reason?: string; p_verified: boolean }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: {
          p_reason?: string
          p_role: Database["public"]["Enums"]["user_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      area_to_sqm: {
        Args: { unit: Database["public"]["Enums"]["area_unit"]; value: number }
        Returns: number
      }
      audit_redact: { Args: { payload: Json }; Returns: Json }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      check_area_consistency: {
        Args: { p_property_id: string }
        Returns: number
      }
      choose_account_type: {
        Args: { p_role: Database["public"]["Enums"]["user_role"] }
        Returns: undefined
      }
      cluster_markers: {
        Args: {
          p_filters?: Json
          p_max_lat: number
          p_max_lng: number
          p_min_lat: number
          p_min_lng: number
          p_zoom: number
        }
        Returns: Json
      }
      consume_rate_limit: {
        Args: {
          p_bucket: string
          p_limit: number
          p_subject: string
          p_window?: string
        }
        Returns: boolean
      }
      count_properties: { Args: { p_filters?: Json }; Returns: number }
      current_aal: { Args: never; Returns: string }
      ensure_audit_partition: { Args: { at?: string }; Returns: undefined }
      get_payment_methods_public: {
        Args: { p_property_id: string }
        Returns: Json
      }
      get_property_public: { Args: { p_slug: string }; Returns: Json }
      get_public_profile: { Args: { p_user_id: string }; Returns: Json }
      admin_live_analytics: { Args: never; Returns: Json }
      record_presence: {
        Args: { p_session_hash: string; p_path: string; p_property_id?: string }
        Returns: undefined
      }
      property_contact_summary: { Args: { p_property_id: string }; Returns: Json }
      reveal_property_contacts: { Args: { p_property_id: string }; Returns: Json }
      start_property_conversation: { Args: { p_property_id: string }; Returns: string }
      mark_thread_read: { Args: { p_thread_id: string }; Returns: undefined }
      list_conversations: { Args: never; Returns: Json }
      unread_message_count: { Args: never; Returns: number }
      get_conversation: { Args: { p_thread_id: string }; Returns: Json }
      admin_read_conversation: {
        Args: { p_thread_id: string; p_reason: string }
        Returns: Json
      }
      has_permission: { Args: { p_key: string }; Returns: boolean }
      is_active_user: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_thread_participant: { Args: { p_thread_id: string }; Returns: boolean }
      owns_property: { Args: { p_property_id: string }; Returns: boolean }
      owns_property_row: {
        Args: { p_agency_id: string; p_owner_id: string }
        Returns: boolean
      }
      parcel_iou: { Args: { a: unknown; b: unknown }; Returns: number }
      record_property_view: {
        Args: {
          p_property_id: string
          p_referrer?: string
          p_viewer_hash: string
        }
        Returns: undefined
      }
      reinstate_user: {
        Args: { p_reason: string; p_user_id: string }
        Returns: undefined
      }
      reveal_contact: {
        Args: {
          p_channel: Database["public"]["Enums"]["contact_channel"]
          p_property_id: string
        }
        Returns: string
      }
      search_properties: {
        Args: { p_cursor?: Json; p_filters?: Json; p_limit?: number }
        Returns: {
          address_line: string
          area_sqm: number
          bathrooms: number
          bedrooms: number
          category: Database["public"]["Enums"]["property_category"]
          cover: Json
          distance_m: number
          favorite_count: number
          id: string
          lat: number
          listed_by_role: Database["public"]["Enums"]["user_role"]
          lng: number
          location_name: string
          location_slug: string
          price: number
          price_period: Database["public"]["Enums"]["price_period"]
          province_slug: string
          published_at: string
          reference_code: string
          slug: string
          subtype: Database["public"]["Enums"]["property_subtype"]
          title: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          verified: boolean
        }[]
      }
      shares_thread_with: { Args: { p_user_id: string }; Returns: boolean }
      similar_properties: {
        Args: { p_limit?: number; p_property_id: string }
        Returns: {
          address_line: string | null
          agency_id: string | null
          area_raw: Json
          area_sqm: number | null
          area_unit_entered: Database["public"]["Enums"]["area_unit"]
          bathrooms: number | null
          bedrooms: number | null
          built_area_sqm: number | null
          category: Database["public"]["Enums"]["property_category"]
          claimed_boundary: unknown
          created_at: string
          deleted_at: string | null
          description: string
          enquiry_count: number
          expires_at: string | null
          favorite_count: number
          feature_ids: string[]
          floors: number | null
          geom: unknown
          geom_precision: Database["public"]["Enums"]["geo_precision"]
          id: string
          listed_by_role: Database["public"]["Enums"]["user_role"]
          location_id: string
          owner_id: string
          parking: number | null
          price: number
          price_negotiable: boolean
          price_period: Database["public"]["Enums"]["price_period"] | null
          published_at: string | null
          reference_code: string
          rejection_reason: string | null
          road_access_ft: number | null
          search_vector: unknown
          service_charge: number | null
          show_email: boolean
          show_payment_info: boolean
          show_phone: boolean
          show_whatsapp: boolean
          slug: string
          status: Database["public"]["Enums"]["property_status"]
          subtype: Database["public"]["Enums"]["property_subtype"]
          title: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          view_count: number
        }[]
        SetofOptions: {
          from: "*"
          to: "properties"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      sqm_to_area: {
        Args: { unit: Database["public"]["Enums"]["area_unit"]; value: number }
        Returns: number
      }
      suspend_user: {
        Args: { p_reason: string; p_user_id: string }
        Returns: undefined
      }
      verify_property_location: {
        Args: {
          p_property_id: string
          p_reference: unknown
          p_source?: string
          p_threshold?: number
        }
        Returns: {
          passed: boolean
          score: number
        }[]
      }
      write_audit: {
        Args: {
          p_action: Database["public"]["Enums"]["audit_action"]
          p_entity_id: string
          p_entity_type: string
          p_new?: Json
          p_previous?: Json
          p_summary?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      account_status: "pending_verification" | "active" | "suspended" | "banned"
      appointment_status:
        | "requested"
        | "confirmed"
        | "rescheduled"
        | "completed"
        | "cancelled"
        | "declined"
      area_unit:
        | "sqm"
        | "sqft"
        | "ropani"
        | "aana"
        | "paisa"
        | "daam"
        | "bigha"
        | "kattha"
        | "dhur"
      attribute_value_type: "text" | "number" | "boolean" | "enum"
      audit_action:
        | "create"
        | "update"
        | "delete"
        | "status_change"
        | "role_change"
        | "permission_change"
        | "contact_reveal"
        | "verification"
        | "payment_review"
        | "login"
        | "logout"
        | "suspend"
        | "service_role_write"
      check_kind:
        | "location_iou"
        | "point_in_boundary"
        | "area_consistency"
        | "image_duplicate"
      contact_channel: "phone" | "email" | "whatsapp"
      document_kind: "floor_plan" | "lalpurja" | "identity" | "other"
      enquiry_status: "new" | "read" | "replied" | "closed"
      geo_precision: "exact" | "approximate"
      location_level:
        | "country"
        | "province"
        | "district"
        | "municipality"
        | "ward"
      notification_type:
        | "enquiry"
        | "appointment"
        | "message"
        | "payment"
        | "moderation"
        | "saved_search"
        | "system"
      payment_provider: "esewa" | "khalti" | "imepay" | "connectips" | "bank"
      payment_status: "pending" | "approved" | "rejected"
      price_period: "month" | "year" | "night"
      property_category: "residential" | "land" | "commercial"
      property_status:
        | "draft"
        | "pending_review"
        | "published"
        | "rejected"
        | "sold"
        | "rented"
        | "archived"
      property_subtype:
        | "house"
        | "apartment"
        | "villa"
        | "condo"
        | "townhouse"
        | "studio"
        | "residential_land"
        | "agricultural_land"
        | "commercial_land"
        | "office"
        | "shop"
        | "warehouse"
        | "factory"
      report_status: "open" | "investigating" | "resolved" | "dismissed"
      report_target: "property" | "review" | "user" | "message"
      review_status: "pending" | "published" | "rejected"
      transaction_type: "sale" | "rent" | "lease" | "short_stay"
      trust_event_type:
        | "listed"
        | "published"
        | "price_changed"
        | "relisted"
        | "identity_verified"
        | "document_sighted"
        | "gps_confirmed"
        | "reported"
        | "report_resolved"
        | "verification_revoked"
      user_role:
        | "platform_admin"
        | "agency_manager"
        | "agent"
        | "property_owner"
        | "customer"
      verification_status: "pending" | "approved" | "rejected"
      video_kind: "upload" | "youtube" | "vimeo" | "virtual_tour"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_status: ["pending_verification", "active", "suspended", "banned"],
      appointment_status: [
        "requested",
        "confirmed",
        "rescheduled",
        "completed",
        "cancelled",
        "declined",
      ],
      area_unit: [
        "sqm",
        "sqft",
        "ropani",
        "aana",
        "paisa",
        "daam",
        "bigha",
        "kattha",
        "dhur",
      ],
      attribute_value_type: ["text", "number", "boolean", "enum"],
      audit_action: [
        "create",
        "update",
        "delete",
        "status_change",
        "role_change",
        "permission_change",
        "contact_reveal",
        "verification",
        "payment_review",
        "login",
        "logout",
        "suspend",
        "service_role_write",
      ],
      check_kind: [
        "location_iou",
        "point_in_boundary",
        "area_consistency",
        "image_duplicate",
      ],
      contact_channel: ["phone", "email", "whatsapp"],
      document_kind: ["floor_plan", "lalpurja", "identity", "other"],
      enquiry_status: ["new", "read", "replied", "closed"],
      geo_precision: ["exact", "approximate"],
      location_level: [
        "country",
        "province",
        "district",
        "municipality",
        "ward",
      ],
      notification_type: [
        "enquiry",
        "appointment",
        "message",
        "payment",
        "moderation",
        "saved_search",
        "system",
      ],
      payment_provider: ["esewa", "khalti", "imepay", "connectips", "bank"],
      payment_status: ["pending", "approved", "rejected"],
      price_period: ["month", "year", "night"],
      property_category: ["residential", "land", "commercial"],
      property_status: [
        "draft",
        "pending_review",
        "published",
        "rejected",
        "sold",
        "rented",
        "archived",
      ],
      property_subtype: [
        "house",
        "apartment",
        "villa",
        "condo",
        "townhouse",
        "studio",
        "residential_land",
        "agricultural_land",
        "commercial_land",
        "office",
        "shop",
        "warehouse",
        "factory",
      ],
      report_status: ["open", "investigating", "resolved", "dismissed"],
      report_target: ["property", "review", "user", "message"],
      review_status: ["pending", "published", "rejected"],
      transaction_type: ["sale", "rent", "lease", "short_stay"],
      trust_event_type: [
        "listed",
        "published",
        "price_changed",
        "relisted",
        "identity_verified",
        "document_sighted",
        "gps_confirmed",
        "reported",
        "report_resolved",
        "verification_revoked",
      ],
      user_role: [
        "platform_admin",
        "agency_manager",
        "agent",
        "property_owner",
        "customer",
      ],
      verification_status: ["pending", "approved", "rejected"],
      video_kind: ["upload", "youtube", "vimeo", "virtual_tour"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const

