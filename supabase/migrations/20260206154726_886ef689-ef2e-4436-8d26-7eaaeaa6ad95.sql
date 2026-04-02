
-- ============================================
-- AEGIS NGFW - Complete Database Schema
-- ============================================

-- 1. ROLE ENUM
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'operator', 'auditor');

-- 2. PROFILES TABLE
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. USER ROLES TABLE
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. FIREWALL RULES TABLE
CREATE TABLE public.firewall_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_order INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  action TEXT NOT NULL DEFAULT 'block' CHECK (action IN ('pass', 'block', 'reject')),
  interface TEXT NOT NULL DEFAULT 'WAN',
  direction TEXT NOT NULL DEFAULT 'in' CHECK (direction IN ('in', 'out')),
  protocol TEXT NOT NULL DEFAULT 'any',
  source_type TEXT NOT NULL DEFAULT 'any',
  source_value TEXT NOT NULL DEFAULT '*',
  source_port TEXT,
  destination_type TEXT NOT NULL DEFAULT 'any',
  destination_value TEXT NOT NULL DEFAULT '*',
  destination_port TEXT,
  description TEXT NOT NULL DEFAULT '',
  logging BOOLEAN NOT NULL DEFAULT false,
  hits BIGINT NOT NULL DEFAULT 0,
  last_hit TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.firewall_rules ENABLE ROW LEVEL SECURITY;

-- 5. NAT RULES TABLE
CREATE TABLE public.nat_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'port-forward' CHECK (type IN ('port-forward', 'outbound', '1-to-1')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  interface TEXT NOT NULL DEFAULT 'WAN',
  protocol TEXT NOT NULL DEFAULT 'tcp',
  external_address TEXT,
  external_port TEXT NOT NULL DEFAULT '',
  internal_address TEXT NOT NULL DEFAULT '',
  internal_port TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.nat_rules ENABLE ROW LEVEL SECURITY;

-- 6. NETWORK INTERFACES TABLE
CREATE TABLE public.network_interfaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'LAN' CHECK (type IN ('WAN', 'LAN', 'DMZ', 'OPT')),
  status TEXT NOT NULL DEFAULT 'up' CHECK (status IN ('up', 'down', 'disabled')),
  ip_address TEXT,
  subnet TEXT,
  gateway TEXT,
  mac TEXT,
  speed TEXT,
  duplex TEXT DEFAULT 'full',
  mtu INT DEFAULT 1500,
  vlan INT,
  rx_bytes BIGINT DEFAULT 0,
  tx_bytes BIGINT DEFAULT 0,
  rx_packets BIGINT DEFAULT 0,
  tx_packets BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.network_interfaces ENABLE ROW LEVEL SECURITY;

-- 7. VPN TUNNELS TABLE
CREATE TABLE public.vpn_tunnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'ipsec' CHECK (type IN ('ipsec', 'openvpn', 'wireguard', 'ssl')),
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'connecting')),
  remote_gateway TEXT,
  local_network TEXT,
  remote_network TEXT,
  bytes_in BIGINT DEFAULT 0,
  bytes_out BIGINT DEFAULT 0,
  uptime BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vpn_tunnels ENABLE ROW LEVEL SECURITY;

-- 8. THREAT EVENTS TABLE
CREATE TABLE public.threat_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  category TEXT NOT NULL DEFAULT '',
  source_ip TEXT,
  destination_ip TEXT,
  source_port INT,
  destination_port INT,
  protocol TEXT,
  signature TEXT,
  description TEXT,
  action TEXT NOT NULL DEFAULT 'blocked' CHECK (action IN ('blocked', 'allowed', 'monitored')),
  ai_confidence DECIMAL(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.threat_events ENABLE ROW LEVEL SECURITY;

-- 9. SYSTEM SETTINGS TABLE
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL DEFAULT '',
  description TEXT,
  is_auditable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('super_admin', 'admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_operator_or_higher(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('super_admin', 'admin', 'operator')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_any_role(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_firewall_rules_updated_at BEFORE UPDATE ON public.firewall_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_nat_rules_updated_at BEFORE UPDATE ON public.nat_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_network_interfaces_updated_at BEFORE UPDATE ON public.network_interfaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_vpn_tunnels_updated_at BEFORE UPDATE ON public.vpn_tunnels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- RLS POLICIES
-- ============================================

-- PROFILES
CREATE POLICY "Anyone with role can read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_any_role(auth.uid()));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Super admin can manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- USER ROLES
CREATE POLICY "Anyone with role can read roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_any_role(auth.uid()));
CREATE POLICY "Admin+ can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Super admin can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- FIREWALL RULES
CREATE POLICY "Operator+ can read firewall rules" ON public.firewall_rules FOR SELECT TO authenticated USING (public.is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert firewall rules" ON public.firewall_rules FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update firewall rules" ON public.firewall_rules FOR UPDATE TO authenticated USING (public.is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete firewall rules" ON public.firewall_rules FOR DELETE TO authenticated USING (public.is_admin_or_super_admin(auth.uid()));

-- NAT RULES
CREATE POLICY "Operator+ can read nat rules" ON public.nat_rules FOR SELECT TO authenticated USING (public.is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert nat rules" ON public.nat_rules FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update nat rules" ON public.nat_rules FOR UPDATE TO authenticated USING (public.is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete nat rules" ON public.nat_rules FOR DELETE TO authenticated USING (public.is_admin_or_super_admin(auth.uid()));

-- NETWORK INTERFACES
CREATE POLICY "Operator+ can read interfaces" ON public.network_interfaces FOR SELECT TO authenticated USING (public.is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert interfaces" ON public.network_interfaces FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update interfaces" ON public.network_interfaces FOR UPDATE TO authenticated USING (public.is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete interfaces" ON public.network_interfaces FOR DELETE TO authenticated USING (public.is_admin_or_super_admin(auth.uid()));

-- VPN TUNNELS
CREATE POLICY "Operator+ can read vpn tunnels" ON public.vpn_tunnels FOR SELECT TO authenticated USING (public.is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert vpn tunnels" ON public.vpn_tunnels FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update vpn tunnels" ON public.vpn_tunnels FOR UPDATE TO authenticated USING (public.is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete vpn tunnels" ON public.vpn_tunnels FOR DELETE TO authenticated USING (public.is_admin_or_super_admin(auth.uid()));

-- THREAT EVENTS
CREATE POLICY "Any role can read threats" ON public.threat_events FOR SELECT TO authenticated USING (public.is_any_role(auth.uid()));
CREATE POLICY "Super admin can manage threats" ON public.threat_events FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin can update threats" ON public.threat_events FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin can delete threats" ON public.threat_events FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- SYSTEM SETTINGS
CREATE POLICY "Operator+ can read settings" ON public.system_settings FOR SELECT TO authenticated USING (public.is_operator_or_higher(auth.uid()));
CREATE POLICY "Auditor can read auditable settings" ON public.system_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'auditor') AND is_auditable = true);
CREATE POLICY "Admin+ can insert settings" ON public.system_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update settings" ON public.system_settings FOR UPDATE TO authenticated USING (public.is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Super admin can delete settings" ON public.system_settings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
