CREATE TABLE "ai_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"risk_score" integer DEFAULT 0 NOT NULL,
	"anomalies_detected" integer DEFAULT 0 NOT NULL,
	"threats_blocked" integer DEFAULT 0 NOT NULL,
	"predictions" text DEFAULT '{}' NOT NULL,
	"recommendations" text DEFAULT '[]' NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'host' NOT NULL,
	"values" text[] DEFAULT '{}' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"resource_type" text DEFAULT '' NOT NULL,
	"resource_id" text,
	"details" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "av_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"http_scan" boolean DEFAULT true NOT NULL,
	"ftp_scan" boolean DEFAULT true NOT NULL,
	"imap_scan" boolean DEFAULT true NOT NULL,
	"pop3_scan" boolean DEFAULT true NOT NULL,
	"smtp_scan" boolean DEFAULT true NOT NULL,
	"action" text DEFAULT 'block' NOT NULL,
	"emulator_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'local' NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"issuer" text DEFAULT '' NOT NULL,
	"serial_number" text DEFAULT '' NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone DEFAULT now() + interval '1 year' NOT NULL,
	"status" text DEFAULT 'valid' NOT NULL,
	"key_type" text DEFAULT 'RSA' NOT NULL,
	"key_size" integer DEFAULT 2048 NOT NULL,
	"in_use" boolean DEFAULT false NOT NULL,
	"used_by" text[] DEFAULT '{}' NOT NULL,
	"signature_algorithm" text DEFAULT 'SHA256withRSA' NOT NULL,
	"fingerprint" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config_backups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"type" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'success' NOT NULL,
	"firmware_version" text DEFAULT '2025.1' NOT NULL,
	"sections" text[] DEFAULT '{}'::text[] NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dhcp_leases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip" text NOT NULL,
	"mac" text NOT NULL,
	"hostname" text DEFAULT '' NOT NULL,
	"lease_start" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_end" timestamp with time zone DEFAULT now() + interval '1 day' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"interface" text DEFAULT 'LAN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dhcp_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interface" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"range_start" text DEFAULT '' NOT NULL,
	"range_end" text DEFAULT '' NOT NULL,
	"gateway" text DEFAULT '' NOT NULL,
	"netmask" text DEFAULT '255.255.255.0' NOT NULL,
	"dns1" text DEFAULT '8.8.8.8' NOT NULL,
	"dns2" text DEFAULT '8.8.4.4' NOT NULL,
	"domain" text DEFAULT '' NOT NULL,
	"lease_time" integer DEFAULT 86400 NOT NULL,
	"active_leases" integer DEFAULT 0 NOT NULL,
	"total_pool" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dhcp_static_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"mac" text NOT NULL,
	"ip" text NOT NULL,
	"interface" text DEFAULT 'LAN' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dns_filter_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"domain_filter" boolean DEFAULT true NOT NULL,
	"fortiguard_category" boolean DEFAULT true NOT NULL,
	"safe_search" boolean DEFAULT true NOT NULL,
	"youtube_restrict" boolean DEFAULT false NOT NULL,
	"log_all_domains" boolean DEFAULT true NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"blocked_categories" integer DEFAULT 0 NOT NULL,
	"references_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dns_forward_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'forward' NOT NULL,
	"servers" text[] DEFAULT '{}' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dns_local_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hostname" text NOT NULL,
	"domain" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'A' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"ttl" integer DEFAULT 3600 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "firewall_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"action" text DEFAULT 'block' NOT NULL,
	"interface" text DEFAULT 'WAN' NOT NULL,
	"direction" text DEFAULT 'in' NOT NULL,
	"protocol" text DEFAULT 'any' NOT NULL,
	"source_type" text DEFAULT 'any' NOT NULL,
	"source_value" text DEFAULT '*' NOT NULL,
	"source_port" text,
	"destination_type" text DEFAULT 'any' NOT NULL,
	"destination_value" text DEFAULT '*' NOT NULL,
	"destination_port" text,
	"description" text DEFAULT '' NOT NULL,
	"logging" boolean DEFAULT false NOT NULL,
	"hits" bigint DEFAULT 0 NOT NULL,
	"last_hit" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "ids_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sid" integer NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"action" text DEFAULT 'alert' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"hits" bigint DEFAULT 0 NOT NULL,
	"last_hit" timestamp with time zone,
	"description" text DEFAULT '' NOT NULL,
	"cve" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ip_pools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"comments" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'overload' NOT NULL,
	"start_ip" text DEFAULT '' NOT NULL,
	"end_ip" text DEFAULT '' NOT NULL,
	"associated_interface" text DEFAULT 'wan1' NOT NULL,
	"arp_reply" boolean DEFAULT true NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"used_ips" integer DEFAULT 0 NOT NULL,
	"total_ips" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nat_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text DEFAULT 'port-forward' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"interface" text DEFAULT 'WAN' NOT NULL,
	"protocol" text DEFAULT 'tcp' NOT NULL,
	"external_address" text,
	"external_port" text DEFAULT '' NOT NULL,
	"internal_address" text DEFAULT '' NOT NULL,
	"internal_port" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "network_interfaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'LAN' NOT NULL,
	"status" text DEFAULT 'up' NOT NULL,
	"ip_address" text,
	"subnet" text,
	"gateway" text,
	"mac" text,
	"speed" text,
	"duplex" text DEFAULT 'full',
	"mtu" integer DEFAULT 1500,
	"vlan" integer,
	"rx_bytes" bigint DEFAULT 0,
	"tx_bytes" bigint DEFAULT 0,
	"rx_packets" bigint DEFAULT 0,
	"tx_packets" bigint DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packet_captures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"interface" text DEFAULT 'any' NOT NULL,
	"filter" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'stopped' NOT NULL,
	"packets" integer DEFAULT 0 NOT NULL,
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"pcap_file" text,
	"started_at" timestamp with time zone,
	"stopped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" integer DEFAULT 1 NOT NULL,
	"incoming" text DEFAULT 'internal' NOT NULL,
	"source" text DEFAULT '0.0.0.0/0' NOT NULL,
	"destination" text DEFAULT '0.0.0.0/0' NOT NULL,
	"protocol" text DEFAULT 'any' NOT NULL,
	"gateway" text DEFAULT '' NOT NULL,
	"out_interface" text DEFAULT 'wan1' NOT NULL,
	"status" text DEFAULT 'enabled' NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"days" integer[] DEFAULT '{}' NOT NULL,
	"start_time" text DEFAULT '00:00' NOT NULL,
	"end_time" text DEFAULT '23:59' NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'Custom' NOT NULL,
	"protocol" text DEFAULT 'TCP' NOT NULL,
	"dest_ports" text DEFAULT '' NOT NULL,
	"source_ports" text DEFAULT '1-65535' NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"references_count" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ssl_inspection_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"inspection_mode" text DEFAULT 'certificate-inspection' NOT NULL,
	"https_enabled" boolean DEFAULT true NOT NULL,
	"smtps_enabled" boolean DEFAULT false NOT NULL,
	"pop3s_enabled" boolean DEFAULT false NOT NULL,
	"imaps_enabled" boolean DEFAULT false NOT NULL,
	"ftps_enabled" boolean DEFAULT false NOT NULL,
	"ca_certificate" text DEFAULT '' NOT NULL,
	"untrusted_cert_action" text DEFAULT 'allow' NOT NULL,
	"expired_cert_action" text DEFAULT 'allow' NOT NULL,
	"references_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "static_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destination" text NOT NULL,
	"gateway" text NOT NULL,
	"interface" text DEFAULT 'wan1' NOT NULL,
	"distance" integer DEFAULT 10 NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'enabled' NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hostname" text DEFAULT '' NOT NULL,
	"uptime" bigint DEFAULT 0 NOT NULL,
	"cpu_usage" numeric(5, 2) DEFAULT '0' NOT NULL,
	"cpu_cores" integer DEFAULT 1 NOT NULL,
	"cpu_temperature" numeric(5, 2) DEFAULT '0' NOT NULL,
	"memory_total" bigint DEFAULT 0 NOT NULL,
	"memory_used" bigint DEFAULT 0 NOT NULL,
	"memory_free" bigint DEFAULT 0 NOT NULL,
	"memory_cached" bigint DEFAULT 0 NOT NULL,
	"disk_total" bigint DEFAULT 0 NOT NULL,
	"disk_used" bigint DEFAULT 0 NOT NULL,
	"disk_free" bigint DEFAULT 0 NOT NULL,
	"load_1m" numeric(6, 2) DEFAULT '0' NOT NULL,
	"load_5m" numeric(6, 2) DEFAULT '0' NOT NULL,
	"load_15m" numeric(6, 2) DEFAULT '0' NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"description" text,
	"is_auditable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "threat_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"severity" text DEFAULT 'low' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"source_ip" text,
	"destination_ip" text,
	"source_port" integer,
	"destination_port" integer,
	"protocol" text,
	"signature" text,
	"description" text,
	"action" text DEFAULT 'blocked' NOT NULL,
	"ai_confidence" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "traffic_shapers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'shared' NOT NULL,
	"guaranteed_bandwidth" integer DEFAULT 0 NOT NULL,
	"maximum_bandwidth" integer DEFAULT 0 NOT NULL,
	"burst_bandwidth" integer DEFAULT 0 NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"per_policy" boolean DEFAULT true NOT NULL,
	"diffserv_forward" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"current_usage" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "traffic_shaping_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"src_interface" text DEFAULT 'lan' NOT NULL,
	"dst_interface" text DEFAULT 'wan1' NOT NULL,
	"source" text DEFAULT 'all' NOT NULL,
	"destination" text DEFAULT 'all' NOT NULL,
	"service" text DEFAULT 'ALL' NOT NULL,
	"application" text DEFAULT '' NOT NULL,
	"traffic_shaper" text DEFAULT '' NOT NULL,
	"reverse_shaper" text DEFAULT '' NOT NULL,
	"per_ip_shaper" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"matches" bigint DEFAULT 0 NOT NULL,
	"bytes" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "traffic_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interface" text DEFAULT '' NOT NULL,
	"inbound" bigint DEFAULT 0 NOT NULL,
	"outbound" bigint DEFAULT 0 NOT NULL,
	"blocked" bigint DEFAULT 0 NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"full_name" text DEFAULT '' NOT NULL,
	"password_hash" text NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "virtual_ips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"comments" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'static-nat' NOT NULL,
	"external_ip" text DEFAULT '' NOT NULL,
	"mapped_ip" text DEFAULT '' NOT NULL,
	"interface" text DEFAULT 'wan1' NOT NULL,
	"protocol" text DEFAULT 'TCP' NOT NULL,
	"external_port" text DEFAULT '' NOT NULL,
	"mapped_port" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vpn_tunnels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'ipsec' NOT NULL,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"remote_gateway" text,
	"local_network" text,
	"remote_network" text,
	"bytes_in" bigint DEFAULT 0,
	"bytes_out" bigint DEFAULT 0,
	"uptime" bigint DEFAULT 0,
	"config_json" text,
	"comment" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "web_filter_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"action" text DEFAULT 'block' NOT NULL,
	"references_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wildcard_fqdns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"fqdn" text NOT NULL,
	"interface" text DEFAULT 'any' NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"visibility" boolean DEFAULT true NOT NULL,
	"references_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;