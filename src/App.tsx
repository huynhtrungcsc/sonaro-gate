import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import ThreatMonitor from "./pages/ThreatMonitor";
import ThreatDetail from "./pages/ThreatDetail";
import Incidents from "./pages/Incidents";
import FirewallRules from "./pages/FirewallRules";
import Aliases from "./pages/Aliases";
import NATConfig from "./pages/NATConfig";
import Interfaces from "./pages/Interfaces";
import InterfaceAssignment from "./pages/InterfaceAssignment";
import DHCP from "./pages/DHCP";
import DNSServer from "./pages/DNSServer";
import VPN from "./pages/VPN";
import SystemLogs from "./pages/SystemLogs";
import Schedules from "./pages/Schedules";
import ConfigBackup from "./pages/ConfigBackup";
import SystemBackup from "./pages/SystemBackup";
import IDSSettings from "./pages/IDSSettings";
import Routing from "./pages/Routing";
import StaticRoutes from "./pages/StaticRoutes";
import PolicyRoutes from "./pages/PolicyRoutes";
import RIPConfig from "./pages/RIPConfig";
import OSPFConfig from "./pages/OSPFConfig";
import BGPConfig from "./pages/BGPConfig";
import PacketCapture from "./pages/PacketCapture";
import Reports from "./pages/Reports";
import SystemSettings from "./pages/SystemSettings";
import TrafficAnalysis from "./pages/TrafficAnalysis";
import HighAvailability from "./pages/HighAvailability";
import CertificateManagement from "./pages/CertificateManagement";
import LogReport from "./pages/LogReport";
import AdminProfiles from "./pages/AdminProfiles";
import VirtualIPs from "./pages/VirtualIPs";
import IPPools from "./pages/IPPools";
import TrafficShapers from "./pages/TrafficShapers";
import TrafficShapingPolicy from "./pages/TrafficShapingPolicy";
import WildcardFQDN from "./pages/WildcardFQDN";
import Services from "./pages/Services";
import DNSFilter from "./pages/DNSFilter";
import UserGroups from "./pages/UserGroups";
import LocalUsers from "./pages/LocalUsers";
import AuthServers from "./pages/AuthServers";
import NotFound from "./pages/NotFound";


const P = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <DemoModeProvider>
          <Routes>
            {/* Public */}
            <Route path="/auth" element={<Auth />} />

            {/* Protected */}
            <Route path="/" element={<P><Index /></P>} />

            {/* Base section redirects */}
            <Route path="/firewall" element={<Navigate to="/firewall/rules" replace />} />
            <Route path="/security" element={<Navigate to="/security/ids" replace />} />
            <Route path="/vpn" element={<Navigate to="/vpn/ipsec" replace />} />
            <Route path="/users" element={<Navigate to="/users/groups" replace />} />
            <Route path="/monitoring" element={<Navigate to="/monitoring/traffic" replace />} />
            <Route path="/system" element={<Navigate to="/system/general" replace />} />

            {/* Threats & Incidents */}
            <Route path="/threats" element={<P><ThreatMonitor /></P>} />
            <Route path="/threats/:id" element={<P><ThreatDetail /></P>} />
            <Route path="/incidents" element={<P><Incidents /></P>} />

            {/* Policy & Objects */}
            <Route path="/firewall/rules" element={<P><FirewallRules /></P>} />
            <Route path="/firewall/aliases" element={<P><Aliases /></P>} />
            <Route path="/firewall/wildcard-fqdn" element={<P><WildcardFQDN /></P>} />
            <Route path="/firewall/nat" element={<P><NATConfig /></P>} />
            <Route path="/firewall/virtual-ips" element={<P><VirtualIPs /></P>} />
            <Route path="/firewall/ip-pools" element={<P><IPPools /></P>} />
            <Route path="/firewall/traffic-shapers" element={<P><TrafficShapers /></P>} />
            <Route path="/firewall/traffic-shaping-policy" element={<P><TrafficShapingPolicy /></P>} />
            <Route path="/firewall/schedules" element={<P><Schedules /></P>} />
            <Route path="/firewall/services" element={<P><Services /></P>} />

            {/* Security Profiles */}
            <Route path="/security/ids" element={<P><IDSSettings /></P>} />
            <Route path="/security/dnsfilter" element={<P><DNSFilter /></P>} />

            {/* Interfaces */}
            <Route path="/interfaces" element={<P><Interfaces /></P>} />
            <Route path="/interfaces/assignment" element={<P><InterfaceAssignment /></P>} />

            {/* Routing */}
            <Route path="/routing" element={<P><Routing /></P>} />
            <Route path="/routing/static" element={<P><StaticRoutes /></P>} />
            <Route path="/routing/policy" element={<P><PolicyRoutes /></P>} />
            <Route path="/routing/rip" element={<P><RIPConfig /></P>} />
            <Route path="/routing/ospf" element={<P><OSPFConfig /></P>} />
            <Route path="/routing/bgp" element={<P><BGPConfig /></P>} />

            {/* Network tools */}
            <Route path="/packet-capture" element={<P><PacketCapture /></P>} />
            <Route path="/dns" element={<P><DNSServer /></P>} />
            <Route path="/dhcp" element={<P><DHCP /></P>} />

            {/* VPN */}
            <Route path="/vpn/ipsec" element={<P><VPN /></P>} />
            <Route path="/vpn/openvpn" element={<P><VPN /></P>} />
            <Route path="/vpn/wireguard" element={<P><VPN /></P>} />
            <Route path="/vpn/monitor" element={<P><VPN /></P>} />

            {/* Users */}
            <Route path="/users/local"        element={<P><LocalUsers /></P>} />
            <Route path="/users/groups"       element={<P><UserGroups /></P>} />
            <Route path="/users/auth-servers" element={<P><AuthServers /></P>} />

            {/* Monitoring */}
            <Route path="/monitoring/logs" element={<P><SystemLogs /></P>} />
            <Route path="/monitoring/traffic" element={<P><TrafficAnalysis /></P>} />
            <Route path="/monitor/ipsec" element={<Navigate to="/vpn/ipsec" replace />} />
            <Route path="/monitor/routing" element={<Navigate to="/routing/static" replace />} />

            {/* Logs & Reports */}
            <Route path="/reports" element={<P><Reports /></P>} />
            <Route path="/logs" element={<P><LogReport /></P>} />

            {/* System */}
            <Route path="/system/general" element={<P><SystemSettings /></P>} />
            <Route path="/system/backup" element={<P><ConfigBackup /></P>} />
            <Route path="/system/full-backup" element={<P><SystemBackup /></P>} />
            <Route path="/system/users" element={<Navigate to="/system/admins" replace />} />
            <Route path="/system/admins" element={<P><AdminProfiles /></P>} />
            <Route path="/system/admin-profiles" element={<Navigate to="/system/admins" replace />} />
            <Route path="/system/ha" element={<P><HighAvailability /></P>} />
            <Route path="/system/certificates" element={<P><CertificateManagement /></P>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          </DemoModeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
