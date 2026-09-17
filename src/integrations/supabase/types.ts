export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_agent_config: {
        Row: {
          allowed_sources: Json
          batch_size: number
          config_key: string
          created_at: string
          enabled: boolean
          id: string
          interval_minutes: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed_sources?: Json
          batch_size?: number
          config_key: string
          created_at?: string
          enabled?: boolean
          id?: string
          interval_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed_sources?: Json
          batch_size?: number
          config_key?: string
          created_at?: string
          enabled?: boolean
          id?: string
          interval_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_jobs: {
        Row: {
          created_at: string
          cursor_asset_id: string | null
          failure_count: number
          id: string
          job_key: string
          last_error: string | null
          last_run_at: string | null
          last_success_at: string | null
          lease_until: string | null
          paused_reason: string | null
          processed_today: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cursor_asset_id?: string | null
          failure_count?: number
          id?: string
          job_key: string
          last_error?: string | null
          last_run_at?: string | null
          last_success_at?: string | null
          lease_until?: string | null
          paused_reason?: string | null
          processed_today?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cursor_asset_id?: string | null
          failure_count?: number
          id?: string
          job_key?: string
          last_error?: string | null
          last_run_at?: string | null
          last_success_at?: string | null
          lease_until?: string | null
          paused_reason?: string | null
          processed_today?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_run_log: {
        Row: {
          approved_count: number
          asset_id: string | null
          changes: Json
          company_id: string | null
          conflict_count: number
          created_at: string
          error: string | null
          finished_at: string
          id: string
          inserted_count: number
          job_key: string
          model: string | null
          pending_count: number
          provider: string | null
          run_id: string
          skipped_count: number
          sources: Json
          started_at: string
          status: string
          trigger: string
        }
        Insert: {
          approved_count?: number
          asset_id?: string | null
          changes?: Json
          company_id?: string | null
          conflict_count?: number
          created_at?: string
          error?: string | null
          finished_at?: string
          id?: string
          inserted_count?: number
          job_key?: string
          model?: string | null
          pending_count?: number
          provider?: string | null
          run_id: string
          skipped_count?: number
          sources?: Json
          started_at?: string
          status?: string
          trigger?: string
        }
        Update: {
          approved_count?: number
          asset_id?: string | null
          changes?: Json
          company_id?: string | null
          conflict_count?: number
          created_at?: string
          error?: string | null
          finished_at?: string
          id?: string
          inserted_count?: number
          job_key?: string
          model?: string | null
          pending_count?: number
          provider?: string | null
          run_id?: string
          skipped_count?: number
          sources?: Json
          started_at?: string
          status?: string
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_run_log_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "exchange_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_run_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          environment: string
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          prefix: string
          request_count: number
          revoked_at: string | null
          scopes: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          environment?: string
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          prefix: string
          request_count?: number
          revoked_at?: string | null
          scopes?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          environment?: string
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          prefix?: string
          request_count?: number
          revoked_at?: string | null
          scopes?: string[]
          user_id?: string
        }
        Relationships: []
      }
      api_request_log: {
        Row: {
          api_key_id: string | null
          created_at: string
          id: string
          path: string
          status: number
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          id?: string
          path: string
          status: number
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          id?: string
          path?: string
          status?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_request_log_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      bet_selections: {
        Row: {
          created_at: string
          event_id: string
          id: string
          line: number | null
          market: string
          price: number
          result: string
          selection: string
          slip_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          line?: number | null
          market: string
          price: number
          result?: string
          selection: string
          slip_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          line?: number | null
          market?: string
          price?: number
          result?: string
          selection?: string
          slip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bet_selections_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "sport_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bet_selections_slip_id_fkey"
            columns: ["slip_id"]
            isOneToOne: false
            referencedRelation: "bet_slips"
            referencedColumns: ["id"]
          },
        ]
      }
      bet_slips: {
        Row: {
          created_at: string
          free_bet_id: string | null
          funding: string
          id: string
          idempotency_key: string
          kind: string
          payout: number | null
          potential_payout: number
          reference: string
          settled_at: string | null
          stake: number
          status: string
          total_odds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          free_bet_id?: string | null
          funding?: string
          id?: string
          idempotency_key: string
          kind: string
          payout?: number | null
          potential_payout: number
          reference: string
          settled_at?: string | null
          stake: number
          status?: string
          total_odds: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          free_bet_id?: string | null
          funding?: string
          id?: string
          idempotency_key?: string
          kind?: string
          payout?: number | null
          potential_payout?: number
          reference?: string
          settled_at?: string | null
          stake?: number
          status?: string
          total_odds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bet_slips_free_bet_id_fkey"
            columns: ["free_bet_id"]
            isOneToOne: false
            referencedRelation: "free_bets"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_grants: {
        Row: {
          amount: number
          created_at: string
          expires_at: string | null
          id: string
          kind: string
          metadata: Json
          promotion_id: string
          reference: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          kind: string
          metadata?: Json
          promotion_id: string
          reference: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          kind?: string
          metadata?: Json
          promotion_id?: string
          reference?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_grants_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          bonus_wallet_id: string
          created_at: string
          id: string
          metadata: Json
          reference: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          bonus_wallet_id: string
          created_at?: string
          id?: string
          metadata?: Json
          reference: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          bonus_wallet_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          reference?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_transactions_bonus_wallet_id_fkey"
            columns: ["bonus_wallet_id"]
            isOneToOne: false
            referencedRelation: "bonus_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string
          description: string
          founded_year: number | null
          headquarters: string | null
          id: string
          legal_name: string | null
          listed_bvm: boolean
          name: string
          sector: string
          slug: string
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          description: string
          founded_year?: number | null
          headquarters?: string | null
          id?: string
          legal_name?: string | null
          listed_bvm?: boolean
          name: string
          sector: string
          slug: string
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          founded_year?: number | null
          headquarters?: string | null
          id?: string
          legal_name?: string | null
          listed_bvm?: boolean
          name?: string
          sector?: string
          slug?: string
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      company_applications: {
        Row: {
          company_name: string
          contact_email: string
          contact_name: string
          contact_phone: string | null
          created_at: string
          description: string
          funding_goal: number | null
          id: string
          nuit: string | null
          review_notes: string | null
          sector: string
          status: string
          updated_at: string
          user_id: string | null
          website: string | null
        }
        Insert: {
          company_name: string
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          description: string
          funding_goal?: number | null
          id?: string
          nuit?: string | null
          review_notes?: string | null
          sector: string
          status?: string
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Update: {
          company_name?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          description?: string
          funding_goal?: number | null
          id?: string
          nuit?: string | null
          review_notes?: string | null
          sector?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      company_data_points: {
        Row: {
          asset_id: string
          change_summary: string | null
          collected_at: string
          company_id: string | null
          confidence: number
          conflict_note: string | null
          content_hash: string
          created_at: string
          event_date: string | null
          id: string
          kind: string
          metrics: Json
          model: string | null
          provider: string
          reviewed_at: string | null
          reviewed_by: string | null
          run_id: string | null
          source_name: string
          source_url: string | null
          sources: Json
          status: string
          summary: string | null
          supersedes_id: string | null
          title: string
          updated_at: string
          validation_note: string | null
        }
        Insert: {
          asset_id: string
          change_summary?: string | null
          collected_at?: string
          company_id?: string | null
          confidence?: number
          conflict_note?: string | null
          content_hash: string
          created_at?: string
          event_date?: string | null
          id?: string
          kind: string
          metrics?: Json
          model?: string | null
          provider?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          run_id?: string | null
          source_name: string
          source_url?: string | null
          sources?: Json
          status?: string
          summary?: string | null
          supersedes_id?: string | null
          title: string
          updated_at?: string
          validation_note?: string | null
        }
        Update: {
          asset_id?: string
          change_summary?: string | null
          collected_at?: string
          company_id?: string | null
          confidence?: number
          conflict_note?: string | null
          content_hash?: string
          created_at?: string
          event_date?: string | null
          id?: string
          kind?: string
          metrics?: Json
          model?: string | null
          provider?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          run_id?: string | null
          source_name?: string
          source_url?: string | null
          sources?: Json
          status?: string
          summary?: string | null
          supersedes_id?: string | null
          title?: string
          updated_at?: string
          validation_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_data_points_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "exchange_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_data_points_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_data_points_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "company_data_points"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_assets: {
        Row: {
          ai_monitored: boolean
          asset_type: string
          company_id: string | null
          country: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          environment: string
          id: string
          is_demo: boolean
          issuer_info: string | null
          logo_url: string | null
          lot_size: number
          market_id: string
          name: string
          reference_price: number | null
          reference_price_at: string | null
          reference_price_source: string | null
          status: string
          symbol: string
          tick_size: number
          updated_at: string
        }
        Insert: {
          ai_monitored?: boolean
          asset_type?: string
          company_id?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          environment?: string
          id?: string
          is_demo?: boolean
          issuer_info?: string | null
          logo_url?: string | null
          lot_size?: number
          market_id: string
          name: string
          reference_price?: number | null
          reference_price_at?: string | null
          reference_price_source?: string | null
          status?: string
          symbol: string
          tick_size?: number
          updated_at?: string
        }
        Update: {
          ai_monitored?: boolean
          asset_type?: string
          company_id?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          environment?: string
          id?: string
          is_demo?: boolean
          issuer_info?: string | null
          logo_url?: string | null
          lot_size?: number
          market_id?: string
          name?: string
          reference_price?: number | null
          reference_price_at?: string | null
          reference_price_source?: string | null
          status?: string
          symbol?: string
          tick_size?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_assets_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "exchange_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_listing_applications: {
        Row: {
          asset_id: string | null
          asset_type: string
          company_id: string | null
          company_name: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          description: string | null
          documents: Json
          id: string
          proposed_symbol: string
          reference_price: number | null
          sector: string | null
          shares_offered: number | null
          status: string
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          asset_id?: string | null
          asset_type?: string
          company_id?: string | null
          company_name: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          description?: string | null
          documents?: Json
          id?: string
          proposed_symbol: string
          reference_price?: number | null
          sector?: string | null
          shares_offered?: number | null
          status?: string
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          asset_id?: string | null
          asset_type?: string
          company_id?: string | null
          company_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          description?: string | null
          documents?: Json
          id?: string
          proposed_symbol?: string
          reference_price?: number | null
          sector?: string | null
          shares_offered?: number | null
          status?: string
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exchange_listing_applications_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "exchange_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_listing_applications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_markets: {
        Row: {
          closes_at: string
          code: string
          created_at: string
          environment: string
          id: string
          name: string
          opens_at: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          closes_at?: string
          code: string
          created_at?: string
          environment?: string
          id?: string
          name: string
          opens_at?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          closes_at?: string
          code?: string
          created_at?: string
          environment?: string
          id?: string
          name?: string
          opens_at?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      exchange_orders: {
        Row: {
          account_id: string
          asset_id: string
          avg_fill_price: number | null
          cancelled_at: string | null
          created_at: string
          environment: string
          filled_quantity: number
          id: string
          idempotency_key: string
          limit_price: number | null
          order_type: string
          quantity: number
          reject_reason: string | null
          remaining_quantity: number
          reserved_amount: number
          reserved_quantity: number
          side: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          asset_id: string
          avg_fill_price?: number | null
          cancelled_at?: string | null
          created_at?: string
          environment?: string
          filled_quantity?: number
          id?: string
          idempotency_key: string
          limit_price?: number | null
          order_type: string
          quantity: number
          reject_reason?: string | null
          remaining_quantity: number
          reserved_amount?: number
          reserved_quantity?: number
          side: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          asset_id?: string
          avg_fill_price?: number | null
          cancelled_at?: string | null
          created_at?: string
          environment?: string
          filled_quantity?: number
          id?: string
          idempotency_key?: string
          limit_price?: number | null
          order_type?: string
          quantity?: number
          reject_reason?: string | null
          remaining_quantity?: number
          reserved_amount?: number
          reserved_quantity?: number
          side?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "investment_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_orders_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "exchange_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_public_trades: {
        Row: {
          asset_id: string
          executed_at: string
          price: number
          quantity: number
          trade_id: string
        }
        Insert: {
          asset_id: string
          executed_at: string
          price: number
          quantity: number
          trade_id: string
        }
        Update: {
          asset_id?: string
          executed_at?: string
          price?: number
          quantity?: number
          trade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_public_trades_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "exchange_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_public_trades_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: true
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_reference_price_history: {
        Row: {
          asset_id: string
          changed_by: string | null
          created_at: string
          effective_at: string
          id: string
          price: number
          reason: string | null
          source: string | null
        }
        Insert: {
          asset_id: string
          changed_by?: string | null
          created_at?: string
          effective_at?: string
          id?: string
          price: number
          reason?: string | null
          source?: string | null
        }
        Update: {
          asset_id?: string
          changed_by?: string | null
          created_at?: string
          effective_at?: string
          id?: string
          price?: number
          reason?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exchange_reference_price_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "exchange_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_transfers: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          direction: string
          failure_reason: string | null
          id: string
          idempotency_key: string
          reference: string
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          direction: string
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          reference: string
          source: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          direction?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          reference?: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_transfers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "investment_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_configs: {
        Row: {
          active: boolean
          code: string
          created_at: string
          fixed: number
          id: string
          name: string
          percent: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          fixed?: number
          id?: string
          name: string
          percent?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          fixed?: number
          id?: string
          name?: string
          percent?: number
          updated_at?: string
        }
        Relationships: []
      }
      free_bets: {
        Row: {
          created_at: string
          expires_at: string
          grant_id: string | null
          id: string
          max_amount: number
          min_amount: number
          status: string
          updated_at: string
          used_amount: number | null
          used_at: string | null
          used_bet_id: string | null
          used_context: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          grant_id?: string | null
          id?: string
          max_amount?: number
          min_amount?: number
          status?: string
          updated_at?: string
          used_amount?: number | null
          used_at?: string | null
          used_bet_id?: string | null
          used_context?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          grant_id?: string | null
          id?: string
          max_amount?: number
          min_amount?: number
          status?: string
          updated_at?: string
          used_amount?: number | null
          used_at?: string | null
          used_bet_id?: string | null
          used_context?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "free_bets_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "bonus_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      game_bets: {
        Row: {
          amount: number
          auto_cashout: number | null
          cashed_out_at: string | null
          cashout_multiplier: number | null
          free_bet_id: string | null
          funding: string
          id: string
          payout: number | null
          placed_at: string
          round_id: string
          slot: number
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          auto_cashout?: number | null
          cashed_out_at?: string | null
          cashout_multiplier?: number | null
          free_bet_id?: string | null
          funding?: string
          id?: string
          payout?: number | null
          placed_at?: string
          round_id: string
          slot?: number
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          auto_cashout?: number | null
          cashed_out_at?: string | null
          cashout_multiplier?: number | null
          free_bet_id?: string | null
          funding?: string
          id?: string
          payout?: number | null
          placed_at?: string
          round_id?: string
          slot?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_bets_free_bet_id_fkey"
            columns: ["free_bet_id"]
            isOneToOne: false
            referencedRelation: "free_bets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_bets_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "game_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rounds: {
        Row: {
          betting_closed_at: string | null
          betting_started_at: string | null
          client_seed: string
          crash_multiplier: number | null
          crashed_at: string | null
          created_at: string
          game: string
          house_edge: number
          id: string
          nonce: number
          round_number: number
          server_seed: string | null
          server_seed_hash: string
          settled_at: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          betting_closed_at?: string | null
          betting_started_at?: string | null
          client_seed: string
          crash_multiplier?: number | null
          crashed_at?: string | null
          created_at?: string
          game?: string
          house_edge?: number
          id?: string
          nonce: number
          round_number?: never
          server_seed?: string | null
          server_seed_hash: string
          settled_at?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          betting_closed_at?: string | null
          betting_started_at?: string | null
          client_seed?: string
          crash_multiplier?: number | null
          crashed_at?: string | null
          created_at?: string
          game?: string
          house_edge?: number
          id?: string
          nonce?: number
          round_number?: never
          server_seed?: string | null
          server_seed_hash?: string
          settled_at?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      instant_rounds: {
        Row: {
          client_seed: string
          config: Json
          created_at: string
          finished_at: string | null
          free_bet_id: string | null
          funding: string
          game: string
          id: string
          multiplier: number
          nonce: number
          outcome: Json
          payout: number | null
          picks: Json
          round_number: number
          server_seed: string
          server_seed_hash: string
          stake: number
          status: string
          step: number
          user_id: string
        }
        Insert: {
          client_seed: string
          config?: Json
          created_at?: string
          finished_at?: string | null
          free_bet_id?: string | null
          funding?: string
          game: string
          id?: string
          multiplier?: number
          nonce: number
          outcome?: Json
          payout?: number | null
          picks?: Json
          round_number?: number
          server_seed: string
          server_seed_hash: string
          stake: number
          status?: string
          step?: number
          user_id: string
        }
        Update: {
          client_seed?: string
          config?: Json
          created_at?: string
          finished_at?: string | null
          free_bet_id?: string | null
          funding?: string
          game?: string
          id?: string
          multiplier?: number
          nonce?: number
          outcome?: Json
          payout?: number | null
          picks?: Json
          round_number?: number
          server_seed?: string
          server_seed_hash?: string
          stake?: number
          status?: string
          step?: number
          user_id?: string
        }
        Relationships: []
      }
      investment_accounts: {
        Row: {
          account_type: string
          created_at: string
          currency: string
          environment: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: string
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      investment_documents: {
        Row: {
          content: string | null
          created_at: string
          doc_type: string
          id: string
          product_id: string
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          doc_type?: string
          id?: string
          product_id: string
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          doc_type?: string
          id?: string
          product_id?: string
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investment_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "investment_products"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_order_events: {
        Row: {
          created_at: string
          from_status: string | null
          id: string
          metadata: Json
          note: string | null
          order_id: string
          to_status: string
        }
        Insert: {
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          note?: string | null
          order_id: string
          to_status: string
        }
        Update: {
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          note?: string | null
          order_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "investment_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_orders: {
        Row: {
          amount: number
          created_at: string
          currency: string
          executed_amount: number
          failure_reason: string | null
          id: string
          idempotency_key: string
          investment_id: string | null
          metadata: Json
          product_id: string | null
          reference: string
          side: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          executed_amount?: number
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          investment_id?: string | null
          metadata?: Json
          product_id?: string | null
          reference: string
          side: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          executed_amount?: number
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          investment_id?: string | null
          metadata?: Json
          product_id?: string | null
          reference?: string
          side?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_orders_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "investment_products"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_positions: {
        Row: {
          created_at: string
          currency: string
          current_value: number
          id: string
          invested_amount: number
          product_id: string
          realized_result: number
          unrealized_result: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          current_value?: number
          id?: string
          invested_amount?: number
          product_id: string
          realized_result?: number
          unrealized_result?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          current_value?: number
          id?: string
          invested_amount?: number
          product_id?: string
          realized_result?: number
          unrealized_result?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_positions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "investment_products"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_products: {
        Row: {
          capacity: number
          company_id: string
          created_at: string
          currency: string
          description: string
          id: string
          max_amount: number | null
          min_amount: number
          name: string
          raised: number
          risk_level: string
          rules: Json
          slug: string
          status: string
          target_rate_annual: number
          term_months: number
          updated_at: string
          variable_return: boolean
        }
        Insert: {
          capacity?: number
          company_id: string
          created_at?: string
          currency?: string
          description: string
          id?: string
          max_amount?: number | null
          min_amount?: number
          name: string
          raised?: number
          risk_level?: string
          rules?: Json
          slug: string
          status?: string
          target_rate_annual: number
          term_months: number
          updated_at?: string
          variable_return?: boolean
        }
        Update: {
          capacity?: number
          company_id?: string
          created_at?: string
          currency?: string
          description?: string
          id?: string
          max_amount?: number | null
          min_amount?: number
          name?: string
          raised?: number
          risk_level?: string
          rules?: Json
          slug?: string
          status?: string
          target_rate_annual?: number
          term_months?: number
          updated_at?: string
          variable_return?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "investment_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_redemptions: {
        Row: {
          created_at: string
          id: string
          investment_id: string
          order_id: string | null
          principal: number
          reference: string
          return_amount: number
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          investment_id: string
          order_id?: string | null
          principal?: number
          reference: string
          return_amount?: number
          status?: string
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          investment_id?: string
          order_id?: string | null
          principal?: number
          reference?: string
          return_amount?: number
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_redemptions_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "investment_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_returns: {
        Row: {
          amount: number
          created_at: string
          id: string
          investment_id: string
          kind: string
          metadata: Json
          period_end: string | null
          period_start: string | null
          product_id: string | null
          reference: string
          settled: boolean
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          investment_id: string
          kind: string
          metadata?: Json
          period_end?: string | null
          period_start?: string | null
          product_id?: string | null
          reference: string
          settled?: boolean
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          investment_id?: string
          kind?: string
          metadata?: Json
          period_end?: string | null
          period_start?: string | null
          product_id?: string | null
          reference?: string
          settled?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_returns_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_returns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "investment_products"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          accrued_return: number
          amount: number
          cancelled_at: string | null
          created_at: string
          id: string
          matures_at: string
          order_id: string | null
          principal: number | null
          product_id: string
          redeemed_at: string | null
          reference: string
          status: string
          target_rate_annual: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accrued_return?: number
          amount: number
          cancelled_at?: string | null
          created_at?: string
          id?: string
          matures_at: string
          order_id?: string | null
          principal?: number | null
          product_id: string
          redeemed_at?: string | null
          reference: string
          status?: string
          target_rate_annual: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accrued_return?: number
          amount?: number
          cancelled_at?: string | null
          created_at?: string
          id?: string
          matures_at?: string
          order_id?: string | null
          principal?: number | null
          product_id?: string
          redeemed_at?: string | null
          reference?: string
          status?: string
          target_rate_annual?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "investment_products"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_documents: {
        Row: {
          created_at: string
          doc_type: string
          id: string
          kyc_profile_id: string | null
          status: string
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_type: string
          id?: string
          kyc_profile_id?: string | null
          status?: string
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          id?: string
          kyc_profile_id?: string | null
          status?: string
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_documents_kyc_profile_id_fkey"
            columns: ["kyc_profile_id"]
            isOneToOne: false
            referencedRelation: "kyc_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_profiles: {
        Row: {
          address: string | null
          created_at: string
          date_of_birth: string | null
          document_number: string
          document_type: string
          full_name: string
          id: string
          nationality: string
          province: string | null
          review_notes: string | null
          reviewed_at: string | null
          risk_profile: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          date_of_birth?: string | null
          document_number: string
          document_type?: string
          full_name: string
          id?: string
          nationality?: string
          province?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          risk_profile?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          date_of_birth?: string | null
          document_number?: string
          document_type?: string
          full_name?: string
          id?: string
          nationality?: string
          province?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          risk_profile?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ledger_accounts: {
        Row: {
          account_id: string | null
          code: string
          created_at: string
          currency: string
          id: string
          kind: string
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          code: string
          created_at?: string
          currency?: string
          id?: string
          kind: string
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          code?: string
          created_at?: string
          currency?: string
          id?: string
          kind?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "investment_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          created_at: string
          credit: number
          currency: string
          debit: number
          id: string
          ledger_account_id: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          credit?: number
          currency?: string
          debit?: number
          id?: string
          ledger_account_id: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          credit?: number
          currency?: string
          debit?: number
          id?: string
          ledger_account_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_ledger_account_id_fkey"
            columns: ["ledger_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_transactions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          reference: string
          reference_id: string | null
          reference_type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          reference: string
          reference_id?: string | null
          reference_type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          reference?: string
          reference_id?: string | null
          reference_type?: string
        }
        Relationships: []
      }
      loss_streaks: {
        Row: {
          created_at: string
          day: string
          id: string
          lost_amount: number
          lost_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          id?: string
          lost_amount?: number
          lost_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          lost_amount?: number
          lost_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      market_data: {
        Row: {
          asset_id: string
          day_high: number | null
          day_low: number | null
          last_price: number | null
          prev_close: number | null
          trades_count: number
          updated_at: string
          volume: number
        }
        Insert: {
          asset_id: string
          day_high?: number | null
          day_low?: number | null
          last_price?: number | null
          prev_close?: number | null
          trades_count?: number
          updated_at?: string
          volume?: number
        }
        Update: {
          asset_id?: string
          day_high?: number | null
          day_low?: number | null
          last_price?: number | null
          prev_close?: number | null
          trades_count?: number
          updated_at?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "market_data_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "exchange_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      market_sessions: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          market_id: string
          note: string | null
          status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          market_id: string
          note?: string | null
          status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          market_id?: string
          note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_sessions_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "exchange_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          category: string
          created_at: string
          id: string
          metadata: Json
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          metadata?: Json
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          metadata?: Json
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      oauth_authorization_codes: {
        Row: {
          client_id: string
          code_challenge: string | null
          code_challenge_method: string | null
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          redirect_uri: string
          scopes: string[]
          used_at: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          code_challenge?: string | null
          code_challenge_method?: string | null
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          redirect_uri: string
          scopes: string[]
          used_at?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          code_challenge?: string | null
          code_challenge_method?: string | null
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          redirect_uri?: string
          scopes?: string[]
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_authorization_codes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["client_id"]
          },
        ]
      }
      oauth_clients: {
        Row: {
          client_id: string
          client_secret_hash: string
          created_at: string
          id: string
          name: string
          owner_user_id: string
          redirect_uris: string[]
          revoked_at: string | null
          scopes: string[]
        }
        Insert: {
          client_id: string
          client_secret_hash: string
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          redirect_uris: string[]
          revoked_at?: string | null
          scopes?: string[]
        }
        Update: {
          client_id?: string
          client_secret_hash?: string
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          redirect_uris?: string[]
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: []
      }
      oauth_tokens: {
        Row: {
          access_token_hash: string
          client_id: string
          created_at: string
          environment: string
          expires_at: string
          id: string
          last_used_at: string | null
          refresh_token_hash: string | null
          revoked_at: string | null
          scopes: string[]
          user_id: string
        }
        Insert: {
          access_token_hash: string
          client_id: string
          created_at?: string
          environment?: string
          expires_at: string
          id?: string
          last_used_at?: string | null
          refresh_token_hash?: string | null
          revoked_at?: string | null
          scopes: string[]
          user_id: string
        }
        Update: {
          access_token_hash?: string
          client_id?: string
          created_at?: string
          environment?: string
          expires_at?: string
          id?: string
          last_used_at?: string | null
          refresh_token_hash?: string | null
          revoked_at?: string | null
          scopes?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["client_id"]
          },
        ]
      }
      order_events: {
        Row: {
          created_at: string
          from_status: string | null
          id: string
          metadata: Json
          note: string | null
          order_id: string
          to_status: string
        }
        Insert: {
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          note?: string | null
          order_id: string
          to_status: string
        }
        Update: {
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          note?: string | null
          order_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "exchange_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          amount: number
          created_at: string
          currency: string
          direction: string
          id: string
          metadata: Json
          method: string
          payer_identifier: string | null
          provider: string
          provider_transaction_id: string | null
          reference: string
          status: string
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          direction: string
          id?: string
          metadata?: Json
          method: string
          payer_identifier?: string | null
          provider?: string
          provider_transaction_id?: string | null
          reference: string
          status?: string
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          direction?: string
          id?: string
          metadata?: Json
          method?: string
          payer_identifier?: string | null
          provider?: string
          provider_transaction_id?: string | null
          reference?: string
          status?: string
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          account_id: string
          asset_id: string
          avg_price: number
          created_at: string
          id: string
          quantity: number
          realized_pnl: number
          reserved_quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          asset_id: string
          avg_price?: number
          created_at?: string
          id?: string
          quantity?: number
          realized_pnl?: number
          reserved_quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          asset_id?: string
          avg_price?: number
          created_at?: string
          id?: string
          quantity?: number
          realized_pnl?: number
          reserved_quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "investment_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "exchange_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string
          ends_at: string | null
          id: string
          kind: string
          name: string
          params: Json
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description: string
          ends_at?: string | null
          id?: string
          kind: string
          name: string
          params?: Json
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string
          ends_at?: string | null
          id?: string
          kind?: string
          name?: string
          params?: Json
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      risk_alerts: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          message: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      risk_limits: {
        Row: {
          active: boolean
          created_at: string
          id: string
          max_daily_volume: number
          max_open_orders: number
          max_order_value: number
          max_position_value: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          max_daily_volume?: number
          max_open_orders?: number
          max_order_value?: number
          max_position_value?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          max_daily_volume?: number
          max_open_orders?: number
          max_order_value?: number
          max_position_value?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      sport_competitions: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key: string
          name: string
          region: string | null
          sport_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key: string
          name: string
          region?: string | null
          sport_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key?: string
          name?: string
          region?: string | null
          sport_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sport_competitions_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      sport_events: {
        Row: {
          away_logo: string | null
          away_score: number | null
          away_team: string
          commence_at: string
          competition_id: string
          created_at: string
          home_logo: string | null
          home_score: number | null
          home_team: string
          id: string
          odds_updated_at: string | null
          provider_event_id: string
          settled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          away_logo?: string | null
          away_score?: number | null
          away_team: string
          commence_at: string
          competition_id: string
          created_at?: string
          home_logo?: string | null
          home_score?: number | null
          home_team: string
          id?: string
          odds_updated_at?: string | null
          provider_event_id: string
          settled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          away_logo?: string | null
          away_score?: number | null
          away_team?: string
          commence_at?: string
          competition_id?: string
          created_at?: string
          home_logo?: string | null
          home_score?: number | null
          home_team?: string
          id?: string
          odds_updated_at?: string | null
          provider_event_id?: string
          settled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sport_events_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "sport_competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      sport_odds: {
        Row: {
          active: boolean
          created_at: string
          event_id: string
          id: string
          line: number | null
          market: string
          price: number
          selection: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          event_id: string
          id?: string
          line?: number | null
          market: string
          price: number
          selection: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          event_id?: string
          id?: string
          line?: number | null
          market?: string
          price?: number
          selection?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sport_odds_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "sport_events"
            referencedColumns: ["id"]
          },
        ]
      }
      sports: {
        Row: {
          active: boolean
          created_at: string
          grouping: string
          id: string
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          grouping?: string
          id?: string
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          grouping?: string
          id?: string
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          asset_id: string
          buy_order_id: string
          buyer_account_id: string
          buyer_fee: number
          buyer_id: string
          environment: string
          executed_at: string
          gross_value: number
          id: string
          net_buyer_value: number
          net_seller_value: number
          price: number
          quantity: number
          reference: string
          sell_order_id: string
          seller_account_id: string
          seller_fee: number
          seller_id: string
          settlement_status: string
        }
        Insert: {
          asset_id: string
          buy_order_id: string
          buyer_account_id: string
          buyer_fee?: number
          buyer_id: string
          environment?: string
          executed_at?: string
          gross_value: number
          id?: string
          net_buyer_value: number
          net_seller_value: number
          price: number
          quantity: number
          reference: string
          sell_order_id: string
          seller_account_id: string
          seller_fee?: number
          seller_id: string
          settlement_status?: string
        }
        Update: {
          asset_id?: string
          buy_order_id?: string
          buyer_account_id?: string
          buyer_fee?: number
          buyer_id?: string
          environment?: string
          executed_at?: string
          gross_value?: number
          id?: string
          net_buyer_value?: number
          net_seller_value?: number
          price?: number
          quantity?: number
          reference?: string
          sell_order_id?: string
          seller_account_id?: string
          seller_fee?: number
          seller_id?: string
          settlement_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "exchange_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_buy_order_id_fkey"
            columns: ["buy_order_id"]
            isOneToOne: false
            referencedRelation: "exchange_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_buyer_account_id_fkey"
            columns: ["buyer_account_id"]
            isOneToOne: false
            referencedRelation: "investment_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_sell_order_id_fkey"
            columns: ["sell_order_id"]
            isOneToOne: false
            referencedRelation: "exchange_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_seller_account_id_fkey"
            columns: ["seller_account_id"]
            isOneToOne: false
            referencedRelation: "investment_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          id: string
          metadata: Json
          provider: string | null
          provider_transaction_id: string | null
          reference: string
          status: string
          type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          id?: string
          metadata?: Json
          provider?: string | null
          provider_transaction_id?: string | null
          reference: string
          status?: string
          type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          id?: string
          metadata?: Json
          provider?: string | null
          provider_transaction_id?: string | null
          reference?: string
          status?: string
          type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          kind: string
          reserved: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          kind?: string
          reserved?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          kind?: string
          reserved?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      watchlists: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlists_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "exchange_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          delivered_at: string | null
          endpoint_id: string
          error: string | null
          event: string
          id: string
          next_attempt_at: string
          payload: Json
          response_status: number | null
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          endpoint_id: string
          error?: string | null
          event: string
          id?: string
          next_attempt_at?: string
          payload: Json
          response_status?: number | null
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          endpoint_id?: string
          error?: string | null
          event?: string
          id?: string
          next_attempt_at?: string
          payload?: Json
          response_status?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          environment: string
          events: string[]
          failure_count: number
          id: string
          last_delivery_at: string | null
          secret: string
          url: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          environment?: string
          events?: string[]
          failure_count?: number
          id?: string
          last_delivery_at?: string | null
          secret: string
          url: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          environment?: string
          events?: string[]
          failure_count?: number
          id?: string
          last_delivery_at?: string | null
          secret?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ai_job_acquire: {
        Args: { _job_key: string; _lease_seconds?: number }
        Returns: {
          created_at: string
          cursor_asset_id: string | null
          failure_count: number
          id: string
          job_key: string
          last_error: string | null
          last_run_at: string | null
          last_success_at: string | null
          lease_until: string | null
          paused_reason: string | null
          processed_today: number
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ai_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ai_job_release: {
        Args: {
          _error?: string
          _job_key: string
          _ok: boolean
          _pause?: boolean
          _processed?: number
        }
        Returns: undefined
      }
      bonus_apply: {
        Args: {
          _amount: number
          _metadata?: Json
          _reference: string
          _type: string
          _user_id: string
        }
        Returns: {
          amount: number
          balance_after: number
          balance_before: number
          bonus_wallet_id: string
          created_at: string
          id: string
          metadata: Json
          reference: string
          type: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bonus_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_investment: {
        Args: { _investment_id: string; _user_id: string }
        Returns: {
          accrued_return: number
          amount: number
          cancelled_at: string | null
          created_at: string
          id: string
          matures_at: string
          order_id: string | null
          principal: number | null
          product_id: string
          redeemed_at: string | null
          reference: string
          status: string
          target_rate_annual: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "investments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cashout_bet: {
        Args: { _bet_id: string; _user_id: string }
        Returns: {
          amount: number
          auto_cashout: number | null
          cashed_out_at: string | null
          cashout_multiplier: number | null
          free_bet_id: string | null
          funding: string
          id: string
          payout: number | null
          placed_at: string
          round_id: string
          slot: number
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "game_bets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      chicken_multiplier: {
        Args: { _doors: number; _step: number }
        Returns: number
      }
      chicken_traps: {
        Args: {
          _client_seed: string
          _doors: number
          _levels: number
          _nonce: number
          _server_seed: string
        }
        Returns: number[]
      }
      crash_multiplier_at: {
        Args: { _at?: string; _started_at: string }
        Returns: number
      }
      crash_result: {
        Args: {
          _client_seed: string
          _house_edge?: number
          _nonce: number
          _server_seed: string
        }
        Returns: number
      }
      ensure_bonus_wallet: { Args: { _user_id: string }; Returns: string }
      ensure_wallet: {
        Args: { _kind: string; _user_id: string }
        Returns: string
      }
      exchange_audit: {
        Args: {
          _action: string
          _entity: string
          _entity_id: string
          _metadata?: Json
          _user_id: string
        }
        Returns: undefined
      }
      exchange_balance: {
        Args: { _ledger_account_id: string }
        Returns: number
      }
      exchange_cancel_order: {
        Args: { _admin?: boolean; _order_id: string; _user_id: string }
        Returns: {
          account_id: string
          asset_id: string
          avg_fill_price: number | null
          cancelled_at: string | null
          created_at: string
          environment: string
          filled_quantity: number
          id: string
          idempotency_key: string
          limit_price: number | null
          order_type: string
          quantity: number
          reject_reason: string | null
          remaining_quantity: number
          reserved_amount: number
          reserved_quantity: number
          side: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "exchange_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      exchange_cash: {
        Args: { _account_id: string }
        Returns: {
          available: number
          reserved: number
          securities: number
        }[]
      }
      exchange_create_order: {
        Args: {
          _asset_id: string
          _env?: string
          _idempotency_key: string
          _limit_price: number
          _order_type: string
          _quantity: number
          _side: string
          _user_id: string
        }
        Returns: {
          account_id: string
          asset_id: string
          avg_fill_price: number | null
          cancelled_at: string | null
          created_at: string
          environment: string
          filled_quantity: number
          id: string
          idempotency_key: string
          limit_price: number | null
          order_type: string
          quantity: number
          reject_reason: string | null
          remaining_quantity: number
          reserved_amount: number
          reserved_quantity: number
          side: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "exchange_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      exchange_ensure_account: {
        Args: { _env?: string; _user_id: string }
        Returns: string
      }
      exchange_execute_trade: {
        Args: {
          _buy_id: string
          _price: number
          _quantity: number
          _sell_id: string
        }
        Returns: {
          asset_id: string
          buy_order_id: string
          buyer_account_id: string
          buyer_fee: number
          buyer_id: string
          environment: string
          executed_at: string
          gross_value: number
          id: string
          net_buyer_value: number
          net_seller_value: number
          price: number
          quantity: number
          reference: string
          sell_order_id: string
          seller_account_id: string
          seller_fee: number
          seller_id: string
          settlement_status: string
        }
        SetofOptions: {
          from: "*"
          to: "trades"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      exchange_grant_paper_cash: {
        Args: { _amount: number; _idempotency_key: string; _user_id: string }
        Returns: {
          account_id: string
          amount: number
          created_at: string
          direction: string
          failure_reason: string | null
          id: string
          idempotency_key: string
          reference: string
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "exchange_transfers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      exchange_ledger_account: {
        Args: { _account_id: string; _kind: string }
        Returns: string
      }
      exchange_ledger_post: {
        Args: {
          _description?: string
          _entries: Json
          _reference: string
          _reference_id: string
          _reference_type: string
        }
        Returns: string
      }
      exchange_order_book: {
        Args: { _asset_id: string; _depth?: number }
        Returns: {
          orders: number
          price: number
          quantity: number
          side: string
        }[]
      }
      exchange_platform_account: { Args: { _kind: string }; Returns: string }
      exchange_set_market_status: {
        Args: {
          _admin_id: string
          _market_id: string
          _note?: string
          _status: string
        }
        Returns: {
          closes_at: string
          code: string
          created_at: string
          environment: string
          id: string
          name: string
          opens_at: string
          status: string
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "exchange_markets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      exchange_set_reference_price: {
        Args: {
          _admin_id: string
          _asset_id: string
          _price: number
          _source: string
        }
        Returns: {
          ai_monitored: boolean
          asset_type: string
          company_id: string | null
          country: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          environment: string
          id: string
          is_demo: boolean
          issuer_info: string | null
          logo_url: string | null
          lot_size: number
          market_id: string
          name: string
          reference_price: number | null
          reference_price_at: string | null
          reference_price_source: string | null
          status: string
          symbol: string
          tick_size: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "exchange_assets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      exchange_transfer_wallet: {
        Args: {
          _amount: number
          _direction: string
          _idempotency_key: string
          _user_id: string
        }
        Returns: {
          account_id: string
          amount: number
          created_at: string
          direction: string
          failure_reason: string | null
          id: string
          idempotency_key: string
          reference: string
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "exchange_transfers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_bonuses: { Args: never; Returns: number }
      grant_first_deposit_bonus: {
        Args: { _payment_reference: string; _user_id: string }
        Returns: {
          amount: number
          created_at: string
          expires_at: string | null
          id: string
          kind: string
          metadata: Json
          promotion_id: string
          reference: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bonus_grants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      instant_cashout: {
        Args: { _round_id: string; _user_id: string }
        Returns: {
          client_seed: string
          config: Json
          created_at: string
          finished_at: string | null
          free_bet_id: string | null
          funding: string
          game: string
          id: string
          multiplier: number
          nonce: number
          outcome: Json
          payout: number | null
          picks: Json
          round_number: number
          server_seed: string
          server_seed_hash: string
          stake: number
          status: string
          step: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "instant_rounds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      instant_credit: {
        Args: {
          _round: Database["public"]["Tables"]["instant_rounds"]["Row"]
          _user_id: string
        }
        Returns: undefined
      }
      instant_debit: {
        Args: {
          _round: Database["public"]["Tables"]["instant_rounds"]["Row"]
          _user_id: string
        }
        Returns: undefined
      }
      instant_float: {
        Args: {
          _client_seed: string
          _index: number
          _nonce: number
          _server_seed: string
        }
        Returns: number
      }
      instant_pick: {
        Args: { _pick: number; _round_id: string; _user_id: string }
        Returns: {
          client_seed: string
          config: Json
          created_at: string
          finished_at: string | null
          free_bet_id: string | null
          funding: string
          game: string
          id: string
          multiplier: number
          nonce: number
          outcome: Json
          payout: number | null
          picks: Json
          round_number: number
          server_seed: string
          server_seed_hash: string
          stake: number
          status: string
          step: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "instant_rounds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      instant_start: {
        Args: {
          _config?: Json
          _free_bet_id?: string
          _funding?: string
          _game: string
          _stake: number
          _user_id: string
        }
        Returns: {
          client_seed: string
          config: Json
          created_at: string
          finished_at: string | null
          free_bet_id: string | null
          funding: string
          game: string
          id: string
          multiplier: number
          nonce: number
          outcome: Json
          payout: number | null
          picks: Json
          round_number: number
          server_seed: string
          server_seed_hash: string
          stake: number
          status: string
          step: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "instant_rounds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      lion_multiplier: {
        Args: { _step: number; _tiles: number; _traps: number }
        Returns: number
      }
      lion_traps: {
        Args: {
          _client_seed: string
          _nonce: number
          _server_seed: string
          _tiles: number
          _traps: number
        }
        Returns: number[]
      }
      maybe_grant_loss_recovery: {
        Args: { _user_id: string }
        Returns: {
          amount: number
          created_at: string
          expires_at: string | null
          id: string
          kind: string
          metadata: Json
          promotion_id: string
          reference: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bonus_grants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      place_bet:
        | {
            Args: {
              _amount: number
              _auto_cashout?: number
              _round_id: string
              _user_id: string
            }
            Returns: {
              amount: number
              auto_cashout: number | null
              cashed_out_at: string | null
              cashout_multiplier: number | null
              free_bet_id: string | null
              funding: string
              id: string
              payout: number | null
              placed_at: string
              round_id: string
              slot: number
              status: string
              user_id: string
            }
            SetofOptions: {
              from: "*"
              to: "game_bets"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              _amount: number
              _auto_cashout?: number
              _round_id: string
              _slot?: number
              _user_id: string
            }
            Returns: {
              amount: number
              auto_cashout: number | null
              cashed_out_at: string | null
              cashout_multiplier: number | null
              free_bet_id: string | null
              funding: string
              id: string
              payout: number | null
              placed_at: string
              round_id: string
              slot: number
              status: string
              user_id: string
            }
            SetofOptions: {
              from: "*"
              to: "game_bets"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              _amount: number
              _auto_cashout: number
              _free_bet_id: string
              _funding: string
              _round_id: string
              _slot: number
              _user_id: string
            }
            Returns: {
              amount: number
              auto_cashout: number | null
              cashed_out_at: string | null
              cashout_multiplier: number | null
              free_bet_id: string | null
              funding: string
              id: string
              payout: number | null
              placed_at: string
              round_id: string
              slot: number
              status: string
              user_id: string
            }
            SetofOptions: {
              from: "*"
              to: "game_bets"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      place_bet_slip:
        | {
            Args: {
              _idempotency_key: string
              _selections: Json
              _stake: number
              _user_id: string
            }
            Returns: {
              created_at: string
              free_bet_id: string | null
              funding: string
              id: string
              idempotency_key: string
              kind: string
              payout: number | null
              potential_payout: number
              reference: string
              settled_at: string | null
              stake: number
              status: string
              total_odds: number
              updated_at: string
              user_id: string
            }
            SetofOptions: {
              from: "*"
              to: "bet_slips"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              _free_bet_id: string
              _funding: string
              _idempotency_key: string
              _selections: Json
              _stake: number
              _user_id: string
            }
            Returns: {
              created_at: string
              free_bet_id: string | null
              funding: string
              id: string
              idempotency_key: string
              kind: string
              payout: number | null
              potential_payout: number
              reference: string
              settled_at: string | null
              stake: number
              status: string
              total_odds: number
              updated_at: string
              user_id: string
            }
            SetofOptions: {
              from: "*"
              to: "bet_slips"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      place_investment: {
        Args: { _amount: number; _product_id: string; _user_id: string }
        Returns: {
          accrued_return: number
          amount: number
          cancelled_at: string | null
          created_at: string
          id: string
          matures_at: string
          order_id: string | null
          principal: number | null
          product_id: string
          redeemed_at: string | null
          reference: string
          status: string
          target_rate_annual: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "investments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      place_investment_order: {
        Args: {
          _amount: number
          _idempotency_key: string
          _product_id: string
          _user_id: string
        }
        Returns: {
          amount: number
          created_at: string
          currency: string
          executed_amount: number
          failure_reason: string | null
          id: string
          idempotency_key: string
          investment_id: string | null
          metadata: Json
          product_id: string | null
          reference: string
          side: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "investment_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      post_investment_return: {
        Args: {
          _amount: number
          _investment_id: string
          _kind: string
          _period_end?: string
          _period_start?: string
          _reference: string
          _settle?: boolean
        }
        Returns: {
          amount: number
          created_at: string
          id: string
          investment_id: string
          kind: string
          metadata: Json
          period_end: string | null
          period_start: string | null
          product_id: string | null
          reference: string
          settled: boolean
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "investment_returns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recalc_investment_position: {
        Args: { _product_id: string; _user_id: string }
        Returns: undefined
      }
      record_bet_loss: {
        Args: { _amount: number; _user_id: string }
        Returns: undefined
      }
      redeem_investment: {
        Args: {
          _idempotency_key: string
          _investment_id: string
          _user_id: string
        }
        Returns: {
          amount: number
          created_at: string
          currency: string
          executed_amount: number
          failure_reason: string | null
          id: string
          idempotency_key: string
          investment_id: string | null
          metadata: Json
          product_id: string | null
          reference: string
          side: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "investment_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refund_round: { Args: { _round_id: string }; Returns: number }
      resolve_bet_slips: { Args: never; Returns: number }
      round_reveal: {
        Args: { _round_number: number }
        Returns: {
          client_seed: string
          crash_multiplier: number
          nonce: number
          round_number: number
          server_seed: string
          server_seed_hash: string
        }[]
      }
      settle_round: { Args: { _round_id: string }; Returns: number }
      settle_sport_event: {
        Args: { _away: number; _event_id: string; _home: number }
        Returns: number
      }
      sport_selection_outcome: {
        Args: {
          _away: number
          _home: number
          _line: number
          _market: string
          _selection: string
        }
        Returns: string
      }
      transfer_between_wallets: {
        Args: {
          _amount: number
          _from_kind: string
          _to_kind: string
          _user_id: string
        }
        Returns: number
      }
      void_sport_event: { Args: { _event_id: string }; Returns: number }
      wallet_apply: {
        Args: {
          _amount: number
          _metadata?: Json
          _provider?: string
          _provider_transaction_id?: string
          _reference: string
          _type: string
          _wallet_id: string
        }
        Returns: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          id: string
          metadata: Json
          provider: string | null
          provider_transaction_id: string | null
          reference: string
          status: string
          type: string
          wallet_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      wheel_layout: { Args: never; Returns: number[] }
      wheel_spin: {
        Args: { _client_seed: string; _nonce: number; _server_seed: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "player" | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["player", "admin"],
    },
  },
} as const
