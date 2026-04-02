
-- Generic audit log trigger function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
  VALUES (
    auth.uid(),
    TG_OP,  -- INSERT, UPDATE, DELETE
    TG_TABLE_NAME,
    CASE
      WHEN TG_OP = 'DELETE' THEN OLD.id::text
      ELSE NEW.id::text
    END,
    jsonb_build_object(
      'operation', TG_OP,
      'table', TG_TABLE_NAME,
      'old', CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
      'new', CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    ),
    NULL
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Apply audit triggers to critical config tables
CREATE TRIGGER audit_firewall_rules AFTER INSERT OR UPDATE OR DELETE ON public.firewall_rules FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_nat_rules AFTER INSERT OR UPDATE OR DELETE ON public.nat_rules FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_network_interfaces AFTER INSERT OR UPDATE OR DELETE ON public.network_interfaces FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_vpn_tunnels AFTER INSERT OR UPDATE OR DELETE ON public.vpn_tunnels FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_static_routes AFTER INSERT OR UPDATE OR DELETE ON public.static_routes FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_policy_routes AFTER INSERT OR UPDATE OR DELETE ON public.policy_routes FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_system_settings AFTER INSERT OR UPDATE OR DELETE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_ids_signatures AFTER INSERT OR UPDATE OR DELETE ON public.ids_signatures FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_certificates AFTER INSERT OR UPDATE OR DELETE ON public.certificates FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_ssl_inspection AFTER INSERT OR UPDATE OR DELETE ON public.ssl_inspection_profiles FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_dns_filter AFTER INSERT OR UPDATE OR DELETE ON public.dns_filter_profiles FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_av_profiles AFTER INSERT OR UPDATE OR DELETE ON public.av_profiles FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_web_filter AFTER INSERT OR UPDATE OR DELETE ON public.web_filter_profiles FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_ip_pools AFTER INSERT OR UPDATE OR DELETE ON public.ip_pools FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_virtual_ips AFTER INSERT OR UPDATE OR DELETE ON public.virtual_ips FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_dhcp_servers AFTER INSERT OR UPDATE OR DELETE ON public.dhcp_servers FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_aliases AFTER INSERT OR UPDATE OR DELETE ON public.aliases FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_services AFTER INSERT OR UPDATE OR DELETE ON public.services FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_schedules AFTER INSERT OR UPDATE OR DELETE ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_traffic_shapers AFTER INSERT OR UPDATE OR DELETE ON public.traffic_shapers FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_traffic_shaping_policies AFTER INSERT OR UPDATE OR DELETE ON public.traffic_shaping_policies FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_wildcard_fqdns AFTER INSERT OR UPDATE OR DELETE ON public.wildcard_fqdns FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
