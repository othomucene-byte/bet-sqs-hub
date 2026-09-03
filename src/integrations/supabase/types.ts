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
      game_bets: {
        Row: {
          amount: number
          auto_cashout: number | null
          cashed_out_at: string | null
          cashout_multiplier: number | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      ensure_wallet: {
        Args: { _kind: string; _user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
      transfer_between_wallets: {
        Args: {
          _amount: number
          _from_kind: string
          _to_kind: string
          _user_id: string
        }
        Returns: number
      }
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
