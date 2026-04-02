// Sonaro Gate Type Definitions

export interface NetworkInterface {
  id: string;
  name: string;
  type: 'WAN' | 'LAN' | 'DMZ' | 'OPT';
  status: 'up' | 'down' | 'disabled';
  ipAddress: string;
  subnet: string;
  gateway?: string;
  mac: string;
  speed: string;
  duplex: 'full' | 'half' | 'auto';
  mtu: number;
  vlan?: number;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
}

export interface FirewallRule {
  id: string;
  order: number;
  enabled: boolean;
  action: 'pass' | 'block' | 'reject';
  interface: string;
  direction: 'in' | 'out' | 'any';
  protocol: 'any' | 'tcp' | 'udp' | 'icmp' | 'tcp/udp';
  source: {
    type: 'any' | 'network' | 'address' | 'alias';
    value: string;
    port?: string;
  };
  destination: {
    type: 'any' | 'network' | 'address' | 'alias';
    value: string;
    port?: string;
  };
  description: string;
  logging: boolean;
  hits: number;
  lastHit?: Date;
  created: Date;
  schedule?: string;
}

export interface NATRule {
  id: string;
  type: 'port-forward' | 'outbound' | '1:1' | 'npt';
  enabled: boolean;
  interface: string;
  protocol: 'tcp' | 'udp' | 'tcp/udp';
  externalAddress?: string;
  externalPort: string;
  internalAddress: string;
  internalPort: string;
  description: string;
}

export interface DHCPServer {
  interface: string;
  enabled: boolean;
  rangeStart: string;
  rangeEnd: string;
  defaultGateway: string;
  dnsServers: string[];
  domain: string;
  leaseTime: number;
  staticMappings: DHCPStaticMapping[];
}

export interface DHCPStaticMapping {
  id: string;
  mac: string;
  ipAddress: string;
  hostname: string;
  description: string;
}

export interface DHCPLease {
  ip: string;
  mac: string;
  hostname: string;
  start: Date;
  end: Date;
  status: 'active' | 'expired' | 'static';
}

export interface ThreatEvent {
  id: string;
  timestamp: Date;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  sourceIp: string;
  destinationIp: string;
  sourcePort: number;
  destinationPort: number;
  protocol: string;
  signature: string;
  description: string;
  action: 'blocked' | 'alerted' | 'allowed';
  aiConfidence: number;
}

export interface SystemStatus {
  hostname: string;
  uptime: number;
  cpu: {
    usage: number;
    cores: number;
    temperature: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    cached: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
  };
  load: [number, number, number];
}

export interface TrafficStats {
  interface: string;
  inbound: number;
  outbound: number;
  blocked: number;
  timestamp: Date;
}

export interface AIAnalysis {
  riskScore: number;
  anomaliesDetected: number;
  threatsBlocked: number;
  predictions: AIPrediction[];
  recommendations: AIRecommendation[];
}

export interface AIPrediction {
  id: string;
  type: string;
  probability: number;
  description: string;
  timestamp: Date;
}

export interface AIRecommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  action: string;
}

export interface VPNTunnel {
  id: string;
  name: string;
  type: 'ipsec' | 'openvpn' | 'wireguard';
  status: 'connected' | 'disconnected' | 'connecting';
  remoteGateway: string;
  localNetwork: string;
  remoteNetwork: string;
  bytesIn: number;
  bytesOut: number;
  uptime: number;
}
