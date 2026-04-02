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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_analysis: {
        Row: {
          anomalies_detected: number
          id: string
          predictions: Json
          recommendations: Json
          recorded_at: string
          risk_score: number
          threats_blocked: number
        }
        Insert: {
          anomalies_detected?: number
          id?: string
          predictions?: Json
          recommendations?: Json
          recorded_at?: string
          risk_score?: number
          threats_blocked?: number
        }
        Update: {
          anomalies_detected?: number
          id?: string
          predictions?: Json
          recommendations?: Json
          recorded_at?: string
          risk_score?: number
          threats_blocked?: number
        }
        Relationships: []
      }
      aliases: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          type: string
          updated_at: string
          usage_count: number
          values: string[]
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          type?: string
          updated_at?: string
          usage_count?: number
          values?: string[]
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          type?: string
          updated_at?: string
          usage_count?: number
          values?: string[]
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      av_profiles: {
        Row: {
          action: string
          comment: string
          created_at: string
          emulator_enabled: boolean
          ftp_scan: boolean
          http_scan: boolean
          id: string
          imap_scan: boolean
          name: string
          pop3_scan: boolean
          smtp_scan: boolean
          updated_at: string
        }
        Insert: {
          action?: string
          comment?: string
          created_at?: string
          emulator_enabled?: boolean
          ftp_scan?: boolean
          http_scan?: boolean
          id?: string
          imap_scan?: boolean
          name: string
          pop3_scan?: boolean
          smtp_scan?: boolean
          updated_at?: string
        }
        Update: {
          action?: string
          comment?: string
          created_at?: string
          emulator_enabled?: boolean
          ftp_scan?: boolean
          http_scan?: boolean
          id?: string
          imap_scan?: boolean
          name?: string
          pop3_scan?: boolean
          smtp_scan?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          created_at: string
          fingerprint: string
          id: string
          in_use: boolean
          issuer: string
          key_size: number
          key_type: string
          name: string
          serial_number: string
          signature_algorithm: string
          status: string
          subject: string
          type: string
          updated_at: string
          used_by: string[]
          valid_from: string
          valid_to: string
        }
        Insert: {
          created_at?: string
          fingerprint?: string
          id?: string
          in_use?: boolean
          issuer?: string
          key_size?: number
          key_type?: string
          name: string
          serial_number?: string
          signature_algorithm?: string
          status?: string
          subject?: string
          type?: string
          updated_at?: string
          used_by?: string[]
          valid_from?: string
          valid_to?: string
        }
        Update: {
          created_at?: string
          fingerprint?: string
          id?: string
          in_use?: boolean
          issuer?: string
          key_size?: number
          key_type?: string
          name?: string
          serial_number?: string
          signature_algorithm?: string
          status?: string
          subject?: string
          type?: string
          updated_at?: string
          used_by?: string[]
          valid_from?: string
          valid_to?: string
        }
        Relationships: []
      }
      dhcp_leases: {
        Row: {
          created_at: string
          hostname: string
          id: string
          interface: string
          ip: string
          lease_end: string
          lease_start: string
          mac: string
          status: string
        }
        Insert: {
          created_at?: string
          hostname?: string
          id?: string
          interface?: string
          ip: string
          lease_end?: string
          lease_start?: string
          mac: string
          status?: string
        }
        Update: {
          created_at?: string
          hostname?: string
          id?: string
          interface?: string
          ip?: string
          lease_end?: string
          lease_start?: string
          mac?: string
          status?: string
        }
        Relationships: []
      }
      dhcp_servers: {
        Row: {
          active_leases: number
          created_at: string
          dns1: string
          dns2: string
          domain: string
          enabled: boolean
          gateway: string
          id: string
          interface: string
          lease_time: number
          netmask: string
          range_end: string
          range_start: string
          total_pool: number
          updated_at: string
        }
        Insert: {
          active_leases?: number
          created_at?: string
          dns1?: string
          dns2?: string
          domain?: string
          enabled?: boolean
          gateway?: string
          id?: string
          interface: string
          lease_time?: number
          netmask?: string
          range_end?: string
          range_start?: string
          total_pool?: number
          updated_at?: string
        }
        Update: {
          active_leases?: number
          created_at?: string
          dns1?: string
          dns2?: string
          domain?: string
          enabled?: boolean
          gateway?: string
          id?: string
          interface?: string
          lease_time?: number
          netmask?: string
          range_end?: string
          range_start?: string
          total_pool?: number
          updated_at?: string
        }
        Relationships: []
      }
      dhcp_static_mappings: {
        Row: {
          created_at: string
          description: string
          enabled: boolean
          id: string
          interface: string
          ip: string
          mac: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          interface?: string
          ip: string
          mac: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          interface?: string
          ip?: string
          mac?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      dns_filter_profiles: {
        Row: {
          blocked_categories: number
          comment: string
          created_at: string
          domain_filter: boolean
          enabled: boolean
          fortiguard_category: boolean
          id: string
          log_all_domains: boolean
          name: string
          references_count: number
          safe_search: boolean
          updated_at: string
          youtube_restrict: boolean
        }
        Insert: {
          blocked_categories?: number
          comment?: string
          created_at?: string
          domain_filter?: boolean
          enabled?: boolean
          fortiguard_category?: boolean
          id?: string
          log_all_domains?: boolean
          name: string
          references_count?: number
          safe_search?: boolean
          updated_at?: string
          youtube_restrict?: boolean
        }
        Update: {
          blocked_categories?: number
          comment?: string
          created_at?: string
          domain_filter?: boolean
          enabled?: boolean
          fortiguard_category?: boolean
          id?: string
          log_all_domains?: boolean
          name?: string
          references_count?: number
          safe_search?: boolean
          updated_at?: string
          youtube_restrict?: boolean
        }
        Relationships: []
      }
      dns_forward_zones: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          name: string
          servers: string[]
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          servers?: string[]
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          servers?: string[]
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      dns_local_records: {
        Row: {
          address: string
          created_at: string
          domain: string
          enabled: boolean
          hostname: string
          id: string
          ttl: number
          type: string
          updated_at: string
        }
        Insert: {
          address?: string
          created_at?: string
          domain?: string
          enabled?: boolean
          hostname: string
          id?: string
          ttl?: number
          type?: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          domain?: string
          enabled?: boolean
          hostname?: string
          id?: string
          ttl?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      firewall_rules: {
        Row: {
          action: string
          created_at: string
          created_by: string | null
          description: string
          destination_port: string | null
          destination_type: string
          destination_value: string
          direction: string
          enabled: boolean
          hits: number
          id: string
          interface: string
          last_hit: string | null
          logging: boolean
          protocol: string
          rule_order: number
          source_port: string | null
          source_type: string
          source_value: string
          updated_at: string
        }
        Insert: {
          action?: string
          created_at?: string
          created_by?: string | null
          description?: string
          destination_port?: string | null
          destination_type?: string
          destination_value?: string
          direction?: string
          enabled?: boolean
          hits?: number
          id?: string
          interface?: string
          last_hit?: string | null
          logging?: boolean
          protocol?: string
          rule_order?: number
          source_port?: string | null
          source_type?: string
          source_value?: string
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string | null
          description?: string
          destination_port?: string | null
          destination_type?: string
          destination_value?: string
          direction?: string
          enabled?: boolean
          hits?: number
          id?: string
          interface?: string
          last_hit?: string | null
          logging?: boolean
          protocol?: string
          rule_order?: number
          source_port?: string | null
          source_type?: string
          source_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      ids_signatures: {
        Row: {
          action: string
          category: string
          created_at: string
          cve: string | null
          description: string
          enabled: boolean
          hits: number
          id: string
          last_hit: string | null
          name: string
          severity: string
          sid: number
          updated_at: string
        }
        Insert: {
          action?: string
          category?: string
          created_at?: string
          cve?: string | null
          description?: string
          enabled?: boolean
          hits?: number
          id?: string
          last_hit?: string | null
          name: string
          severity?: string
          sid: number
          updated_at?: string
        }
        Update: {
          action?: string
          category?: string
          created_at?: string
          cve?: string | null
          description?: string
          enabled?: boolean
          hits?: number
          id?: string
          last_hit?: string | null
          name?: string
          severity?: string
          sid?: number
          updated_at?: string
        }
        Relationships: []
      }
      ip_pools: {
        Row: {
          arp_reply: boolean
          associated_interface: string
          comments: string
          created_at: string
          enabled: boolean
          end_ip: string
          id: string
          name: string
          start_ip: string
          total_ips: number
          type: string
          updated_at: string
          used_ips: number
        }
        Insert: {
          arp_reply?: boolean
          associated_interface?: string
          comments?: string
          created_at?: string
          enabled?: boolean
          end_ip?: string
          id?: string
          name: string
          start_ip?: string
          total_ips?: number
          type?: string
          updated_at?: string
          used_ips?: number
        }
        Update: {
          arp_reply?: boolean
          associated_interface?: string
          comments?: string
          created_at?: string
          enabled?: boolean
          end_ip?: string
          id?: string
          name?: string
          start_ip?: string
          total_ips?: number
          type?: string
          updated_at?: string
          used_ips?: number
        }
        Relationships: []
      }
      nat_rules: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          enabled: boolean
          external_address: string | null
          external_port: string
          id: string
          interface: string
          internal_address: string
          internal_port: string
          protocol: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          enabled?: boolean
          external_address?: string | null
          external_port?: string
          id?: string
          interface?: string
          internal_address?: string
          internal_port?: string
          protocol?: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          enabled?: boolean
          external_address?: string | null
          external_port?: string
          id?: string
          interface?: string
          internal_address?: string
          internal_port?: string
          protocol?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      network_interfaces: {
        Row: {
          created_at: string
          duplex: string | null
          gateway: string | null
          id: string
          ip_address: string | null
          mac: string | null
          mtu: number | null
          name: string
          rx_bytes: number | null
          rx_packets: number | null
          speed: string | null
          status: string
          subnet: string | null
          tx_bytes: number | null
          tx_packets: number | null
          type: string
          updated_at: string
          vlan: number | null
        }
        Insert: {
          created_at?: string
          duplex?: string | null
          gateway?: string | null
          id?: string
          ip_address?: string | null
          mac?: string | null
          mtu?: number | null
          name: string
          rx_bytes?: number | null
          rx_packets?: number | null
          speed?: string | null
          status?: string
          subnet?: string | null
          tx_bytes?: number | null
          tx_packets?: number | null
          type?: string
          updated_at?: string
          vlan?: number | null
        }
        Update: {
          created_at?: string
          duplex?: string | null
          gateway?: string | null
          id?: string
          ip_address?: string | null
          mac?: string | null
          mtu?: number | null
          name?: string
          rx_bytes?: number | null
          rx_packets?: number | null
          speed?: string | null
          status?: string
          subnet?: string | null
          tx_bytes?: number | null
          tx_packets?: number | null
          type?: string
          updated_at?: string
          vlan?: number | null
        }
        Relationships: []
      }
      policy_routes: {
        Row: {
          comment: string
          created_at: string
          destination: string
          gateway: string
          id: string
          incoming: string
          out_interface: string
          protocol: string
          seq: number
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          comment?: string
          created_at?: string
          destination?: string
          gateway?: string
          id?: string
          incoming?: string
          out_interface?: string
          protocol?: string
          seq?: number
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          comment?: string
          created_at?: string
          destination?: string
          gateway?: string
          id?: string
          incoming?: string
          out_interface?: string
          protocol?: string
          seq?: number
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      schedules: {
        Row: {
          created_at: string
          days: number[]
          description: string
          enabled: boolean
          end_time: string
          id: string
          name: string
          start_time: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          days?: number[]
          description?: string
          enabled?: boolean
          end_time?: string
          id?: string
          name: string
          start_time?: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          days?: number[]
          description?: string
          enabled?: boolean
          end_time?: string
          id?: string
          name?: string
          start_time?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      services: {
        Row: {
          category: string
          comment: string
          created_at: string
          dest_ports: string
          id: string
          is_system: boolean
          name: string
          protocol: string
          references_count: number
          source_ports: string
          updated_at: string
        }
        Insert: {
          category?: string
          comment?: string
          created_at?: string
          dest_ports?: string
          id?: string
          is_system?: boolean
          name: string
          protocol?: string
          references_count?: number
          source_ports?: string
          updated_at?: string
        }
        Update: {
          category?: string
          comment?: string
          created_at?: string
          dest_ports?: string
          id?: string
          is_system?: boolean
          name?: string
          protocol?: string
          references_count?: number
          source_ports?: string
          updated_at?: string
        }
        Relationships: []
      }
      ssl_inspection_profiles: {
        Row: {
          ca_certificate: string
          comment: string
          created_at: string
          enabled: boolean
          expired_cert_action: string
          ftps_enabled: boolean
          https_enabled: boolean
          id: string
          imaps_enabled: boolean
          inspection_mode: string
          name: string
          pop3s_enabled: boolean
          references_count: number
          smtps_enabled: boolean
          untrusted_cert_action: string
          updated_at: string
        }
        Insert: {
          ca_certificate?: string
          comment?: string
          created_at?: string
          enabled?: boolean
          expired_cert_action?: string
          ftps_enabled?: boolean
          https_enabled?: boolean
          id?: string
          imaps_enabled?: boolean
          inspection_mode?: string
          name: string
          pop3s_enabled?: boolean
          references_count?: number
          smtps_enabled?: boolean
          untrusted_cert_action?: string
          updated_at?: string
        }
        Update: {
          ca_certificate?: string
          comment?: string
          created_at?: string
          enabled?: boolean
          expired_cert_action?: string
          ftps_enabled?: boolean
          https_enabled?: boolean
          id?: string
          imaps_enabled?: boolean
          inspection_mode?: string
          name?: string
          pop3s_enabled?: boolean
          references_count?: number
          smtps_enabled?: boolean
          untrusted_cert_action?: string
          updated_at?: string
        }
        Relationships: []
      }
      static_routes: {
        Row: {
          comment: string
          created_at: string
          destination: string
          distance: number
          gateway: string
          id: string
          interface: string
          priority: number
          status: string
          updated_at: string
        }
        Insert: {
          comment?: string
          created_at?: string
          destination: string
          distance?: number
          gateway: string
          id?: string
          interface?: string
          priority?: number
          status?: string
          updated_at?: string
        }
        Update: {
          comment?: string
          created_at?: string
          destination?: string
          distance?: number
          gateway?: string
          id?: string
          interface?: string
          priority?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_metrics: {
        Row: {
          cpu_cores: number
          cpu_temperature: number
          cpu_usage: number
          disk_free: number
          disk_total: number
          disk_used: number
          hostname: string
          id: string
          load_15m: number
          load_1m: number
          load_5m: number
          memory_cached: number
          memory_free: number
          memory_total: number
          memory_used: number
          recorded_at: string
          uptime: number
        }
        Insert: {
          cpu_cores?: number
          cpu_temperature?: number
          cpu_usage?: number
          disk_free?: number
          disk_total?: number
          disk_used?: number
          hostname?: string
          id?: string
          load_15m?: number
          load_1m?: number
          load_5m?: number
          memory_cached?: number
          memory_free?: number
          memory_total?: number
          memory_used?: number
          recorded_at?: string
          uptime?: number
        }
        Update: {
          cpu_cores?: number
          cpu_temperature?: number
          cpu_usage?: number
          disk_free?: number
          disk_total?: number
          disk_used?: number
          hostname?: string
          id?: string
          load_15m?: number
          load_1m?: number
          load_5m?: number
          memory_cached?: number
          memory_free?: number
          memory_total?: number
          memory_used?: number
          recorded_at?: string
          uptime?: number
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_auditable: boolean
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_auditable?: boolean
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_auditable?: boolean
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      threat_events: {
        Row: {
          action: string
          ai_confidence: number | null
          category: string
          created_at: string
          description: string | null
          destination_ip: string | null
          destination_port: number | null
          id: string
          protocol: string | null
          severity: string
          signature: string | null
          source_ip: string | null
          source_port: number | null
        }
        Insert: {
          action?: string
          ai_confidence?: number | null
          category?: string
          created_at?: string
          description?: string | null
          destination_ip?: string | null
          destination_port?: number | null
          id?: string
          protocol?: string | null
          severity?: string
          signature?: string | null
          source_ip?: string | null
          source_port?: number | null
        }
        Update: {
          action?: string
          ai_confidence?: number | null
          category?: string
          created_at?: string
          description?: string | null
          destination_ip?: string | null
          destination_port?: number | null
          id?: string
          protocol?: string | null
          severity?: string
          signature?: string | null
          source_ip?: string | null
          source_port?: number | null
        }
        Relationships: []
      }
      traffic_shapers: {
        Row: {
          burst_bandwidth: number
          created_at: string
          current_usage: number
          diffserv_forward: boolean
          enabled: boolean
          guaranteed_bandwidth: number
          id: string
          maximum_bandwidth: number
          name: string
          per_policy: boolean
          priority: string
          type: string
          updated_at: string
        }
        Insert: {
          burst_bandwidth?: number
          created_at?: string
          current_usage?: number
          diffserv_forward?: boolean
          enabled?: boolean
          guaranteed_bandwidth?: number
          id?: string
          maximum_bandwidth?: number
          name: string
          per_policy?: boolean
          priority?: string
          type?: string
          updated_at?: string
        }
        Update: {
          burst_bandwidth?: number
          created_at?: string
          current_usage?: number
          diffserv_forward?: boolean
          enabled?: boolean
          guaranteed_bandwidth?: number
          id?: string
          maximum_bandwidth?: number
          name?: string
          per_policy?: boolean
          priority?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      traffic_shaping_policies: {
        Row: {
          application: string
          bytes: number
          created_at: string
          destination: string
          dst_interface: string
          enabled: boolean
          id: string
          matches: number
          name: string
          per_ip_shaper: string
          reverse_shaper: string
          service: string
          source: string
          src_interface: string
          traffic_shaper: string
          updated_at: string
        }
        Insert: {
          application?: string
          bytes?: number
          created_at?: string
          destination?: string
          dst_interface?: string
          enabled?: boolean
          id?: string
          matches?: number
          name: string
          per_ip_shaper?: string
          reverse_shaper?: string
          service?: string
          source?: string
          src_interface?: string
          traffic_shaper?: string
          updated_at?: string
        }
        Update: {
          application?: string
          bytes?: number
          created_at?: string
          destination?: string
          dst_interface?: string
          enabled?: boolean
          id?: string
          matches?: number
          name?: string
          per_ip_shaper?: string
          reverse_shaper?: string
          service?: string
          source?: string
          src_interface?: string
          traffic_shaper?: string
          updated_at?: string
        }
        Relationships: []
      }
      traffic_stats: {
        Row: {
          blocked: number
          id: string
          inbound: number
          interface: string
          outbound: number
          recorded_at: string
        }
        Insert: {
          blocked?: number
          id?: string
          inbound?: number
          interface?: string
          outbound?: number
          recorded_at?: string
        }
        Update: {
          blocked?: number
          id?: string
          inbound?: number
          interface?: string
          outbound?: number
          recorded_at?: string
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
      virtual_ips: {
        Row: {
          comments: string
          created_at: string
          enabled: boolean
          external_ip: string
          external_port: string
          id: string
          interface: string
          mapped_ip: string
          mapped_port: string
          name: string
          protocol: string
          sessions: number
          type: string
          updated_at: string
        }
        Insert: {
          comments?: string
          created_at?: string
          enabled?: boolean
          external_ip?: string
          external_port?: string
          id?: string
          interface?: string
          mapped_ip?: string
          mapped_port?: string
          name: string
          protocol?: string
          sessions?: number
          type?: string
          updated_at?: string
        }
        Update: {
          comments?: string
          created_at?: string
          enabled?: boolean
          external_ip?: string
          external_port?: string
          id?: string
          interface?: string
          mapped_ip?: string
          mapped_port?: string
          name?: string
          protocol?: string
          sessions?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      vpn_tunnels: {
        Row: {
          bytes_in: number | null
          bytes_out: number | null
          created_at: string
          id: string
          local_network: string | null
          name: string
          remote_gateway: string | null
          remote_network: string | null
          status: string
          type: string
          updated_at: string
          uptime: number | null
        }
        Insert: {
          bytes_in?: number | null
          bytes_out?: number | null
          created_at?: string
          id?: string
          local_network?: string | null
          name: string
          remote_gateway?: string | null
          remote_network?: string | null
          status?: string
          type?: string
          updated_at?: string
          uptime?: number | null
        }
        Update: {
          bytes_in?: number | null
          bytes_out?: number | null
          created_at?: string
          id?: string
          local_network?: string | null
          name?: string
          remote_gateway?: string | null
          remote_network?: string | null
          status?: string
          type?: string
          updated_at?: string
          uptime?: number | null
        }
        Relationships: []
      }
      web_filter_profiles: {
        Row: {
          action: string
          comment: string
          created_at: string
          id: string
          mode: string
          name: string
          safe_search: boolean
          updated_at: string
          url_filtering: boolean
        }
        Insert: {
          action?: string
          comment?: string
          created_at?: string
          id?: string
          mode?: string
          name: string
          safe_search?: boolean
          updated_at?: string
          url_filtering?: boolean
        }
        Update: {
          action?: string
          comment?: string
          created_at?: string
          id?: string
          mode?: string
          name?: string
          safe_search?: boolean
          updated_at?: string
          url_filtering?: boolean
        }
        Relationships: []
      }
      wildcard_fqdns: {
        Row: {
          comment: string
          created_at: string
          fqdn: string
          id: string
          interface: string
          name: string
          references_count: number
          updated_at: string
          visibility: boolean
        }
        Insert: {
          comment?: string
          created_at?: string
          fqdn: string
          id?: string
          interface?: string
          name: string
          references_count?: number
          updated_at?: string
          visibility?: boolean
        }
        Update: {
          comment?: string
          created_at?: string
          fqdn?: string
          id?: string
          interface?: string
          name?: string
          references_count?: number
          updated_at?: string
          visibility?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      authenticate: {
        Args: { p_email: string; p_password: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_any_role: { Args: { _user_id: string }; Returns: boolean }
      is_operator_or_higher: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "operator" | "auditor"
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
  public: {
    Enums: {
      app_role: ["super_admin", "admin", "operator", "auditor"],
    },
  },
} as const
