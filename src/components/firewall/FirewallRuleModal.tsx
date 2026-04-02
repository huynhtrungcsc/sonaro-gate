import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Plus, 
  ChevronDown, 
  ChevronRight,
  Shield, 
  Globe, 
  Lock, 
  FileText,
  Network,
  ArrowRight,
  Clock,
  Settings,
  CheckCircle2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { FirewallRule } from '@/types/firewall';

// Mock data
const mockAddresses = [
  { name: 'all', type: 'Address', value: '0.0.0.0/0' },
  { name: 'LAN_NETWORK', type: 'Subnet', value: '192.168.1.0/24' },
  { name: 'DMZ_NETWORK', type: 'Subnet', value: '10.0.0.0/24' },
  { name: 'WEB_SERVERS', type: 'Group', value: '192.168.1.10-11' },
  { name: 'BLOCKED_IPS', type: 'Group', value: '45.33.32.0/24' },
];

const mockServices = [
  { name: 'ALL', ports: 'ALL' },
  { name: 'HTTP', ports: 'TCP/80' },
  { name: 'HTTPS', ports: 'TCP/443' },
  { name: 'SSH', ports: 'TCP/22' },
  { name: 'DNS', ports: 'UDP/53' },
  { name: 'SMTP', ports: 'TCP/25' },
  { name: 'FTP', ports: 'TCP/21' },
  { name: 'RDP', ports: 'TCP/3389' },
];

const mockSchedules = [
  { name: 'always', label: 'always' },
  { name: 'business_hours', label: 'Business Hours' },
  { name: 'after_hours', label: 'After Hours' },
  { name: 'weekends', label: 'Weekends' },
];

const mockSecurityProfiles = {
  ips: ['default', 'protect_server', 'protect_client', 'all_default', 'none'],
};

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  enabled: z.boolean(),
  action: z.enum(['accept', 'deny', 'ipsec']),
  incomingInterface: z.string(),
  outgoingInterface: z.string(),
  source: z.string(),
  destination: z.string(),
  schedule: z.string(),
  service: z.string(),
  logging: z.enum(['all', 'utm', 'disable']),
  natEnabled: z.boolean(),
  natType: z.enum(['use-outgoing', 'use-dynamic-ippool', 'use-fixed-ippool']),
  ips: z.string(),
  comments: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

interface FirewallRuleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: FirewallRule | null;
  onSave: (rule: Partial<FirewallRule>) => void;
}

// Collapsible Section Component
const CollapsibleSection = ({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = true 
}: { 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border-b border-border">
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors"
      >
        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Icon size={14} className="text-primary" />
        <span>{title}</span>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
};

// Form Row Component
const FormRow = ({ 
  label, 
  children, 
  required = false 
}: { 
  label: string; 
  children: React.ReactNode;
  required?: boolean;
}) => (
  <div className="grid grid-cols-3 gap-3 items-center">
    <label className="text-xs text-right text-muted-foreground">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    <div className="col-span-2">{children}</div>
  </div>
);

export function FirewallRuleModal({ open, onOpenChange, rule, onSave }: FirewallRuleModalProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      enabled: true,
      action: 'accept',
      incomingInterface: 'LAN',
      outgoingInterface: 'WAN',
      source: 'all',
      destination: 'all',
      schedule: 'always',
      service: 'ALL',
      logging: 'utm',
      natEnabled: true,
      natType: 'use-outgoing',
      ips: 'default',
      comments: '',
    },
  });

  useEffect(() => {
    if (rule) {
      form.reset({
        name: rule.description || '',
        enabled: rule.enabled,
        action: rule.action === 'pass' ? 'accept' : 'deny',
        incomingInterface: rule.interface,
        outgoingInterface: rule.direction === 'out' ? rule.interface : 'WAN',
        source: rule.source.value === '*' ? 'all' : rule.source.value,
        destination: rule.destination.value === '*' ? 'all' : rule.destination.value,
        schedule: rule.schedule || 'always',
        service: rule.destination.port || 'ALL',
        logging: rule.logging ? 'all' : 'disable',
        natEnabled: true,
        natType: 'use-outgoing',
        ips: 'default',
        comments: rule.description || '',
      });
    } else {
      form.reset({
        name: '',
        enabled: true,
        action: 'accept',
        incomingInterface: 'LAN',
        outgoingInterface: 'WAN',
        source: 'all',
        destination: 'all',
        schedule: 'always',
        service: 'ALL',
        logging: 'utm',
        natEnabled: true,
        natType: 'use-outgoing',
        ips: 'default',
        comments: '',
      });
    }
  }, [rule, form]);

  const onSubmit = (values: FormValues) => {
    const ruleData: Partial<FirewallRule> = {
      enabled: values.enabled,
      action: values.action === 'accept' ? 'pass' : 'block',
      interface: values.incomingInterface,
      direction: 'any',
      protocol: 'any',
      source: {
        type: values.source === 'all' ? 'any' : 'address',
        value: values.source === 'all' ? '*' : values.source,
      },
      destination: {
        type: values.destination === 'all' ? 'any' : 'address',
        value: values.destination === 'all' ? '*' : values.destination,
        port: values.service === 'ALL' ? undefined : values.service,
      },
      description: values.name,
      logging: values.logging !== 'disable',
      schedule: values.schedule === 'always' ? undefined : values.schedule,
    };
    onSave(ruleData);
    onOpenChange(false);
  };

  const interfaces = ['WAN', 'LAN', 'DMZ', 'GUEST', 'any'];
  const natEnabled = form.watch('natEnabled');
  const action = form.watch('action');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden max-h-[90vh]">
        {/* FortiGate-style Header */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-[hsl(142,70%,35%)] to-[hsl(142,60%,45%)] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={16} />
            <span className="text-sm font-semibold">
              {rule ? 'Edit Policy' : 'Create New Policy'}
            </span>
          </div>
          <span className="text-xs opacity-80">IPv4 Policy</span>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col max-h-[calc(90vh-120px)]">
            <div className="flex-1 overflow-y-auto">
              {/* Name Section */}
              <CollapsibleSection title="Policy" icon={FileText}>
                <FormRow label="Name" required>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input 
                            {...field} 
                            className="h-8 text-xs" 
                            placeholder="Enter policy name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </FormRow>

                <FormRow label="Status">
                  <FormField
                    control={form.control}
                    name="enabled"
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={field.value} 
                          onCheckedChange={field.onChange}
                        />
                        <span className={cn(
                          "text-xs",
                          field.value ? "text-green-600" : "text-muted-foreground"
                        )}>
                          {field.value ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    )}
                  />
                </FormRow>
              </CollapsibleSection>

              {/* Incoming/Outgoing Interface */}
              <CollapsibleSection title="Source and Destination" icon={Network}>
                <FormRow label="Incoming Interface" required>
                  <FormField
                    control={form.control}
                    name="incomingInterface"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {interfaces.map((iface) => (
                            <SelectItem key={iface} value={iface}>{iface}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormRow>

                <FormRow label="Outgoing Interface" required>
                  <FormField
                    control={form.control}
                    name="outgoingInterface"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {interfaces.map((iface) => (
                            <SelectItem key={iface} value={iface}>{iface}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormRow>

                <FormRow label="Source" required>
                  <FormField
                    control={form.control}
                    name="source"
                    render={({ field }) => (
                      <div className="flex gap-2">
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="h-8 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {mockAddresses.map((addr) => (
                              <SelectItem key={addr.name} value={addr.name}>
                                <span className="flex items-center gap-2">
                                  <span>{addr.name}</span>
                                  <span className="text-muted-foreground text-[10px]">({addr.type})</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="sm" className="h-8 px-2">
                          <Plus size={12} />
                        </Button>
                      </div>
                    )}
                  />
                </FormRow>

                <FormRow label="Destination" required>
                  <FormField
                    control={form.control}
                    name="destination"
                    render={({ field }) => (
                      <div className="flex gap-2">
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="h-8 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {mockAddresses.map((addr) => (
                              <SelectItem key={addr.name} value={addr.name}>
                                <span className="flex items-center gap-2">
                                  <span>{addr.name}</span>
                                  <span className="text-muted-foreground text-[10px]">({addr.type})</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="sm" className="h-8 px-2">
                          <Plus size={12} />
                        </Button>
                      </div>
                    )}
                  />
                </FormRow>
              </CollapsibleSection>

              {/* Service & Schedule */}
              <CollapsibleSection title="Service" icon={Settings}>
                <FormRow label="Schedule">
                  <FormField
                    control={form.control}
                    name="schedule"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {mockSchedules.map((sched) => (
                            <SelectItem key={sched.name} value={sched.name}>{sched.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormRow>

                <FormRow label="Service" required>
                  <FormField
                    control={form.control}
                    name="service"
                    render={({ field }) => (
                      <div className="flex gap-2">
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="h-8 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {mockServices.map((svc) => (
                              <SelectItem key={svc.name} value={svc.name}>
                                <span className="flex items-center gap-2">
                                  <span>{svc.name}</span>
                                  <span className="text-muted-foreground text-[10px]">({svc.ports})</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="sm" className="h-8 px-2">
                          <Plus size={12} />
                        </Button>
                      </div>
                    )}
                  />
                </FormRow>

                <FormRow label="Action">
                  <FormField
                    control={form.control}
                    name="action"
                    render={({ field }) => (
                      <div className="flex gap-1">
                        {[
                          { value: 'accept', label: 'ACCEPT', color: 'bg-green-100 text-green-700 border-green-300' },
                          { value: 'deny', label: 'DENY', color: 'bg-red-100 text-red-700 border-red-300' },
                          { value: 'ipsec', label: 'IPsec', color: 'bg-blue-100 text-blue-700 border-blue-300' },
                        ].map((act) => (
                          <button
                            key={act.value}
                            type="button"
                            onClick={() => field.onChange(act.value)}
                            className={cn(
                              "px-3 py-1 text-[10px] font-semibold rounded border transition-colors",
                              field.value === act.value ? act.color : "bg-muted text-muted-foreground border-border"
                            )}
                          >
                            {act.label}
                          </button>
                        ))}
                      </div>
                    )}
                  />
                </FormRow>
              </CollapsibleSection>

              {/* Firewall / Network Options (NAT) */}
              <CollapsibleSection title="Firewall / Network Options" icon={ArrowRight}>
                <FormRow label="NAT">
                  <FormField
                    control={form.control}
                    name="natEnabled"
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={field.value} 
                          onCheckedChange={field.onChange}
                        />
                        <span className="text-xs text-muted-foreground">
                          {field.value ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    )}
                  />
                </FormRow>

                {natEnabled && (
                  <FormRow label="IP Pool Configuration">
                    <FormField
                      control={form.control}
                      name="natType"
                      render={({ field }) => (
                        <div className="space-y-2">
                          {[
                            { value: 'use-outgoing', label: 'Use Outgoing Interface Address' },
                            { value: 'use-dynamic-ippool', label: 'Use Dynamic IP Pool' },
                            { value: 'use-fixed-ippool', label: 'Use Fixed Port Range' },
                          ].map((opt) => (
                            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="radio" 
                                checked={field.value === opt.value}
                                onChange={() => field.onChange(opt.value)}
                                className="w-3 h-3"
                              />
                              <span className="text-xs">{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    />
                  </FormRow>
                )}
              </CollapsibleSection>

              {/* Security Profiles */}
              {action === 'accept' && (
                <CollapsibleSection title="Security Profiles" icon={Shield}>
                  <div className="bg-muted/50 rounded-sm p-3 mb-3">
                    <p className="text-[10px] text-muted-foreground">
                      Apply IPS (Intrusion Prevention System) profile to this policy.
                    </p>
                  </div>

                  <FormRow label="IPS">
                    <FormField
                      control={form.control}
                      name="ips"
                      render={({ field }) => (
                        <div className="flex items-center gap-2">
                          <Lock size={14} className="text-orange-500" />
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {mockSecurityProfiles.ips.map((profile) => (
                                <SelectItem key={profile} value={profile}>{profile}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    />
                  </FormRow>
                </CollapsibleSection>
              )}

              {/* Logging Options */}
              <CollapsibleSection title="Logging Options" icon={FileText} defaultOpen={false}>
                <FormRow label="Log Allowed Traffic">
                  <FormField
                    control={form.control}
                    name="logging"
                    render={({ field }) => (
                      <div className="flex gap-1">
                        {[
                          { value: 'all', label: 'All Sessions' },
                          { value: 'utm', label: 'Security Events' },
                          { value: 'disable', label: 'Disable' },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => field.onChange(opt.value)}
                            className={cn(
                              "px-2 py-1 text-[10px] rounded border transition-colors",
                              field.value === opt.value 
                                ? "bg-primary text-white border-primary" 
                                : "bg-muted text-muted-foreground border-border"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  />
                </FormRow>

                <FormRow label="Comments">
                  <FormField
                    control={form.control}
                    name="comments"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <textarea 
                            {...field} 
                            className="w-full h-16 px-2 py-1.5 text-xs border border-border rounded-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder="Enter comments..."
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </FormRow>
              </CollapsibleSection>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-4 py-3 bg-muted border-t border-border">
              <Button 
                type="submit"
                className="bg-[hsl(142,70%,35%)] hover:bg-[hsl(142,75%,28%)] text-white h-8"
              >
                OK
              </Button>
              <Button 
                type="button"
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="h-8"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
