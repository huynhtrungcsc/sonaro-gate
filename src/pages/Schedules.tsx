import { useState } from 'react';
import { useSchedules } from '@/hooks/useDbData';
import { schedulesApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/layout/Shell';
import { StatsBar } from '@/components/ui/stats-bar';
import { cn } from '@/lib/utils';
import { 
  Plus, Pencil, Trash2, Clock, Calendar, Sun, Moon, 
  Search, RefreshCw, Copy, ChevronDown, X, Shield
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { FortiToggle } from '@/components/ui/forti-toggle';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

interface Schedule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  days: number[];
  start_time: string;
  end_time: string;
  usage_count: number;
  created_at?: string;
  updated_at?: string;
}

const mockSchedules: Schedule[] = [
  { id: 'sched-1', name: 'business_hours', description: 'Standard business hours', enabled: true, days: [1, 2, 3, 4, 5], start_time: '08:00', end_time: '18:00', usage_count: 8 },
  { id: 'sched-2', name: 'after_hours', description: 'After work hours', enabled: true, days: [1, 2, 3, 4, 5], start_time: '18:00', end_time: '08:00', usage_count: 3 },
  { id: 'sched-3', name: 'weekends', description: 'Weekend access', enabled: true, days: [0, 6], start_time: '00:00', end_time: '23:59', usage_count: 2 },
  { id: 'sched-4', name: 'maintenance_window', description: 'Sunday maintenance window', enabled: true, days: [0], start_time: '02:00', end_time: '06:00', usage_count: 5 },
  { id: 'sched-5', name: 'night_shift', description: 'Night shift access', enabled: false, days: [1, 2, 3, 4, 5], start_time: '22:00', end_time: '06:00', usage_count: 0 },
  { id: 'sched-6', name: 'lunch_break', description: 'Lunch break restriction', enabled: true, days: [1, 2, 3, 4, 5], start_time: '12:00', end_time: '13:00', usage_count: 1 },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(32).regex(/^[a-z][a-z0-9_]*$/, 'Lowercase, starts with letter, letters/numbers/underscores only'),
  description: z.string().max(100),
  enabled: z.boolean(),
  days: z.array(z.number()).min(1, 'Select at least one day'),
  start_time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  end_time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
});

type FormValues = z.infer<typeof formSchema>;

const Schedules = () => {
  const queryClient = useQueryClient();
  const { data: schedules = [], isLoading } = useSchedules();
  const createMut = useMutation({ mutationFn: (d: any) => schedulesApi.create(d), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['schedules'] }); setModalOpen(false); toast.success('Schedule created'); }, onError: () => toast.error('Failed to create schedule') });
  const updateMut = useMutation({ mutationFn: ({ id, d }: { id: string; d: any }) => schedulesApi.update(id, d), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['schedules'] }); setModalOpen(false); toast.success('Schedule updated'); }, onError: () => toast.error('Failed to update schedule') });
  const deleteMut = useMutation({ mutationFn: (id: string) => schedulesApi.delete(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedules'] }), onError: () => toast.error('Failed to delete schedule') });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', description: '', enabled: true, days: [1, 2, 3, 4, 5], start_time: '09:00', end_time: '17:00' },
  });

  const handleAdd = () => {
    setEditingSchedule(null);
    form.reset({ name: '', description: '', enabled: true, days: [1, 2, 3, 4, 5], start_time: '09:00', end_time: '17:00' });
    setModalOpen(true);
  };

  const handleEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    form.reset({ name: schedule.name, description: schedule.description, enabled: schedule.enabled, days: schedule.days, start_time: schedule.start_time, end_time: schedule.end_time });
    setModalOpen(true);
  };

  const handleClone = (schedule: any) => {
    const { id, created_at, updated_at, ...rest } = schedule;
    createMut.mutate({ ...rest, name: `${schedule.name}_copy`, usage_count: 0 });
    toast.success(`Schedule "${schedule.name}" cloned`);
  };

  const handleDeleteConfirm = () => {
    const toDelete = schedules.filter(s => selectedIds.includes(s.id));
    const inUse = toDelete.filter(s => s.usage_count > 0);
    if (inUse.length > 0) {
      toast.error(`Cannot delete: ${inUse.map(s => s.name).join(', ')} still in use`);
      setDeleteDialogOpen(false);
      return;
    }
    selectedIds.forEach(id => deleteMut.mutate(id));
    setSelectedIds([]);
    setDeleteDialogOpen(false);
    toast.success(`${toDelete.length} schedule(s) deleted`);
  };

  const onSubmit = (values: FormValues) => {
    const dbData = { name: values.name, description: values.description, enabled: values.enabled, days: values.days, start_time: values.start_time, end_time: values.end_time };
    if (editingSchedule) {
      updateMut.mutate({ id: (editingSchedule as any).id, d: dbData });
    } else {
      createMut.mutate(dbData);
    }
  };

  const formatDays = (days: number[]) => {
    if (days.length === 7) return 'Every day';
    if (days.length === 5 && !days.includes(0) && !days.includes(6)) return 'Weekdays';
    if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';
    return days.map(d => DAYS[d]).join(', ');
  };

  const isActiveAt = (schedule: Schedule, day: number, hour: number) => {
    if (!schedule.days.includes(day)) return false;
    const start = parseInt(schedule.start_time.split(':')[0]);
    const end = parseInt(schedule.end_time.split(':')[0]);
    if (start <= end) return hour >= start && hour < end;
    return hour >= start || hour < end;
  };

  const getActiveHours = (schedule: Schedule) => {
    const start = parseInt(schedule.start_time.split(':')[0]);
    const end = parseInt(schedule.end_time.split(':')[0]);
    return start <= end ? end - start : (24 - start) + end;
  };

  const handleToggle = (id: string) => {
    const s = (schedules as any[]).find((x: any) => x.id === id);
    if (s) updateMut.mutate({ id, d: { enabled: !s.enabled } });
  };

  const filteredSchedules = schedules.filter(s =>
    searchQuery === '' ||
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: schedules.length,
    enabled: schedules.filter(s => s.enabled).length,
    disabled: schedules.filter(s => !s.enabled).length,
    totalRefs: schedules.reduce((sum, s) => sum + s.usage_count, 0),
  };

  return (
    <Shell>
      <div className="space-y-0">
        {/* Header */}
        <div className="section-header-neutral">
          <div className="flex items-center gap-2">
            <Clock size={14} />
            <span className="font-semibold">Schedules</span>
          </div>
          <span className="text-[10px] text-[#666]">Time-based schedules for firewall policies</span>
        </div>

        {/* Toolbar */}
        <div className="forti-toolbar">
          <button className="forti-toolbar-btn primary" onClick={handleAdd}>
            <Plus size={12} /> Create New
          </button>
          <button 
            className="forti-toolbar-btn" 
            disabled={selectedIds.length !== 1}
            onClick={() => { const s = schedules.find(s => s.id === selectedIds[0]); if (s) handleEdit(s); }}
          >
            <Pencil size={12} /> Edit
          </button>
          <button 
            className="forti-toolbar-btn" 
            disabled={selectedIds.length !== 1}
            onClick={() => { const s = schedules.find(s => s.id === selectedIds[0]); if (s) handleClone(s); }}
          >
            <Copy size={12} /> Clone
          </button>
          <button 
            className="forti-toolbar-btn" 
            disabled={selectedIds.length === 0}
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 size={12} /> Delete
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={() => toast.success('Schedules refreshed')}>
            <RefreshCw size={12} /> Refresh
          </button>
          <div className="flex-1" />
          <div className="forti-search">
            <Search className="w-3 h-3 text-[#999]" />
            <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-[#999] hover:text-[#666]">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Stats Strip */}
        <StatsBar items={[
          { value: stats.total, label: 'Total' },
          { iconNode: <div className="w-2.5 h-2.5 rounded-full bg-green-500" />, value: stats.enabled, label: 'Enabled', color: 'text-green-600' },
          { iconNode: <div className="w-2.5 h-2.5 rounded-full bg-[#ccc]" />, value: stats.disabled, label: 'Disabled', color: 'text-[#999]' },
          { icon: Shield, value: stats.totalRefs, label: 'References', color: 'text-blue-600' },
        ]} />

        {/* Data Table */}
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-8">
                <input 
                  type="checkbox" 
                  className="forti-checkbox"
                  checked={selectedIds.length === filteredSchedules.length && filteredSchedules.length > 0}
                  onChange={() => setSelectedIds(selectedIds.length === filteredSchedules.length ? [] : filteredSchedules.map(s => s.id))}
                />
              </th>
              <th className="w-16">Status</th>
              <th>Name</th>
              <th>Description</th>
              <th>Days</th>
              <th>Time Window</th>
              <th className="w-20 text-center">Hours</th>
              <th className="w-16 text-center">Ref.</th>
              <th className="w-20">Enabled</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {filteredSchedules.map((schedule) => {
              const activeHours = getActiveHours(schedule);
              const isExpanded = expandedId === schedule.id;
              return (
                <> 
                  <tr 
                    key={schedule.id}
                    className={cn(
                      "cursor-pointer",
                      selectedIds.includes(schedule.id) && "selected",
                      !schedule.enabled && "opacity-60"
                    )}
                    onClick={() => {
                      setSelectedIds(prev => prev.includes(schedule.id) ? prev.filter(i => i !== schedule.id) : [...prev, schedule.id]);
                    }}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        className="forti-checkbox"
                        checked={selectedIds.includes(schedule.id)}
                        onChange={() => setSelectedIds(prev => prev.includes(schedule.id) ? prev.filter(i => i !== schedule.id) : [...prev, schedule.id])}
                      />
                    </td>
                    <td>
                      <span className={cn(
                        "forti-tag",
                        schedule.enabled ? "enabled" : "disabled"
                      )}>
                        {schedule.enabled ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="font-mono font-medium text-[#111]">{schedule.name}</td>
                    <td className="text-[#666]">{schedule.description || '—'}</td>
                    <td>
                      <div className="flex gap-0.5">
                        {DAYS.map((day, idx) => (
                          <span 
                            key={day}
                            className={cn(
                              "w-5 h-5 flex items-center justify-center text-[8px] font-bold border",
                              schedule.days.includes(idx)
                                ? "bg-[hsl(142,70%,35%)] text-white border-[hsl(142,75%,28%)]"
                                : "bg-[#f0f0f0] text-[#999] border-[#ddd]"
                            )}
                          >
                            {day[0]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        {parseInt(schedule.start_time) >= 18 || parseInt(schedule.start_time) < 6 
                          ? <Moon size={11} className="text-blue-600" /> 
                          : <Sun size={11} className="text-amber-500" />
                        }
                        <span className="font-mono">{schedule.start_time}</span>
                        <span className="text-[#999]">→</span>
                        <span className="font-mono">{schedule.end_time}</span>
                      </div>
                    </td>
                    <td className="text-center">
                      <span className="text-[11px] font-medium">{activeHours}h</span>
                      <span className="text-[10px] text-[#999]">/day</span>
                    </td>
                    <td className="text-center">
                      <span className={cn(
                        "text-[11px]",
                        schedule.usage_count > 0 ? "text-blue-600 font-medium" : "text-[#999]"
                      )}>
                        {schedule.usage_count}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <FortiToggle enabled={schedule.enabled} onToggle={() => handleToggle(schedule.id)} size="sm" />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button 
                        className="p-0.5 hover:bg-[#f0f0f0] transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : schedule.id)}
                      >
                        <ChevronDown size={12} className={cn("text-[#666] transition-transform", isExpanded && "rotate-180")} />
                      </button>
                    </td>
                  </tr>
                  {/* Expanded Calendar View */}
                  {isExpanded && (
                    <tr key={`${schedule.id}-detail`}>
                      <td colSpan={10} className="p-0 bg-[#fafafa]">
                        <div className="px-4 py-3">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] font-semibold text-[#333]">Weekly Schedule View</span>
                              <span className="text-[10px] text-[#666]">
                                {activeHours * schedule.days.length}h active per week
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-[10px]">
                              <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 bg-[hsl(142,70%,35%)]" />
                                <span className="text-[#666]">Active</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 bg-[#e8e8e8] border border-[#ddd]" />
                                <span className="text-[#666]">Inactive</span>
                              </div>
                            </div>
                          </div>
                          {/* Hour headers */}
                          <div className="flex mb-px">
                            <div className="w-16 shrink-0" />
                            {HOURS.map(hour => (
                              <div key={hour} className="flex-1 text-[8px] text-[#999] text-center">
                                {hour % 3 === 0 ? (hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`) : ''}
                              </div>
                            ))}
                          </div>
                          {/* Day rows */}
                          {DAYS_FULL.map((day, dayIdx) => (
                            <div key={day} className="flex items-center mb-px">
                              <div className={cn(
                                "w-16 shrink-0 text-[10px] pr-2 text-right",
                                schedule.days.includes(dayIdx) ? "font-medium text-[#333]" : "text-[#bbb]"
                              )}>
                                {DAYS[dayIdx]}
                              </div>
                              <div className="flex flex-1 gap-px">
                                {HOURS.map(hour => {
                                  const active = isActiveAt(schedule, dayIdx, hour);
                                  return (
                                    <div
                                      key={hour}
                                      className={cn(
                                        "flex-1 h-4",
                                        active
                                          ? "bg-[hsl(142,70%,35%)]"
                                          : schedule.days.includes(dayIdx)
                                          ? "bg-[#e8e8e8]"
                                          : "bg-[#f5f5f5]"
                                      )}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {filteredSchedules.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center text-[11px] text-[#999] py-8">
                  {searchQuery ? 'No matching schedules found' : 'No schedules configured'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="text-[11px] text-[#666] mt-2 px-1">
          {filteredSchedules.length} schedule(s)
          {selectedIds.length > 0 && ` (${selectedIds.length} selected)`}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="forti-modal-header">
            <DialogTitle className="text-sm font-semibold">
              {editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="forti-modal-body space-y-4">
              <div className="grid grid-cols-3 gap-3 items-start">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem className="col-span-3 grid grid-cols-3 gap-3 items-center space-y-0">
                    <FormLabel className="forti-label text-right">Name</FormLabel>
                    <div className="col-span-2">
                      <FormControl>
                        <Input className="forti-input w-full font-mono" placeholder="business_hours" {...field} onChange={(e) => field.onChange(e.target.value.toLowerCase())} />
                      </FormControl>
                      <FormMessage className="text-[10px] mt-0.5" />
                    </div>
                  </FormItem>
                )} />

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem className="col-span-3 grid grid-cols-3 gap-3 items-center space-y-0">
                    <FormLabel className="forti-label text-right">Description</FormLabel>
                    <div className="col-span-2">
                      <FormControl>
                        <Input className="forti-input w-full" placeholder="Optional description..." {...field} />
                      </FormControl>
                    </div>
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="days" render={({ field }) => (
                <FormItem className="grid grid-cols-3 gap-3 items-start space-y-0">
                  <FormLabel className="forti-label text-right pt-1">Days</FormLabel>
                  <div className="col-span-2">
                    <div className="flex gap-1">
                      {DAYS.map((day, idx) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            const newDays = field.value.includes(idx) ? field.value.filter(d => d !== idx) : [...field.value, idx].sort();
                            field.onChange(newDays);
                          }}
                          className={cn(
                            "flex-1 py-1.5 text-[10px] font-bold border transition-colors",
                            field.value.includes(idx)
                              ? "bg-[hsl(142,70%,35%)] text-white border-[hsl(142,75%,28%)]"
                              : "bg-white text-[#666] border-[#ccc] hover:bg-[#f0f0f0]"
                          )}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-3 mt-1.5">
                      <button type="button" onClick={() => field.onChange([1, 2, 3, 4, 5])} className="text-[10px] text-[hsl(142,70%,35%)] hover:underline">Weekdays</button>
                      <button type="button" onClick={() => field.onChange([0, 6])} className="text-[10px] text-[hsl(142,70%,35%)] hover:underline">Weekends</button>
                      <button type="button" onClick={() => field.onChange([0, 1, 2, 3, 4, 5, 6])} className="text-[10px] text-[hsl(142,70%,35%)] hover:underline">Every day</button>
                    </div>
                    <FormMessage className="text-[10px] mt-0.5" />
                  </div>
                </FormItem>
              )} />

              <div className="grid grid-cols-3 gap-3 items-center">
                <span className="forti-label text-right">Time</span>
                <div className="col-span-2 flex items-center gap-2">
                  <FormField control={form.control} name="start_time" render={({ field }) => (
                    <FormItem className="flex-1 space-y-0">
                      <FormControl><Input type="time" className="forti-input w-full" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <span className="text-[11px] text-[#999]">to</span>
                  <FormField control={form.control} name="end_time" render={({ field }) => (
                    <FormItem className="flex-1 space-y-0">
                      <FormControl><Input type="time" className="forti-input w-full" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>
              </div>

              <FormField control={form.control} name="enabled" render={({ field }) => (
                <FormItem className="grid grid-cols-3 gap-3 items-center space-y-0">
                  <FormLabel className="forti-label text-right">Status</FormLabel>
                  <div className="col-span-2 flex items-center gap-2">
                    <FortiToggle enabled={field.value} onToggle={() => field.onChange(!field.value)} />
                    <span className="text-[11px] text-[#666]">{field.value ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </FormItem>
              )} />

              <div className="forti-modal-footer -mx-4 -mb-4 mt-4">
                <button type="button" className="forti-btn forti-btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="forti-btn forti-btn-primary">{editingSchedule ? 'OK' : 'OK'}</button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription className="text-[11px]">
              Are you sure you want to delete {selectedIds.length} schedule(s)? Schedules in use cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="forti-btn forti-btn-secondary">Cancel</AlertDialogCancel>
            <AlertDialogAction className="forti-btn forti-btn-primary bg-red-500 border-red-600 hover:bg-red-600" onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
};

export default Schedules;
