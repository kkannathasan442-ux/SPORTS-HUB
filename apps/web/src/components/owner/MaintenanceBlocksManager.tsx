'use client';

import React, { useState, useTransition } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { createMaintenanceBlockAction, cancelMaintenanceBlockAction } from '@/lib/owner/actions';
import {
  Plus,
  Wrench,
  AlertCircle,
  Loader2,
  X,
  Save,
  CheckCircle2,
  Calendar,
  XCircle,
} from 'lucide-react';
import type { MaintenanceBlock, FacilityWithSport, MaintenanceBlockStatus } from '@sportshub/types';

interface MaintenanceBlocksManagerProps {
  venueId: string;
  maintenanceBlocks: MaintenanceBlock[];
  facilities: FacilityWithSport[];
}

function getMaintenanceBadge(status: MaintenanceBlockStatus) {
  switch (status) {
    case 'ACTIVE':
      return <Badge variant="warning">ACTIVE</Badge>;
    case 'COMPLETED':
      return <Badge variant="success">COMPLETED</Badge>;
    case 'CANCELLED':
      return <Badge variant="default">CANCELLED</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function MaintenanceBlocksManager({
  venueId,
  maintenanceBlocks,
  facilities,
}: MaintenanceBlocksManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCreateBlock = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const formData = new FormData(e.currentTarget);
    formData.append('venue_id', venueId);

    startTransition(async () => {
      const res = await createMaintenanceBlockAction(null, formData);
      if (res.success) {
        setIsModalOpen(false);
        setSuccessMessage('Maintenance block scheduled successfully.');
      } else {
        setErrorMessage(res.error || 'Failed to schedule maintenance.');
      }
    });
  };

  const handleCancelBlock = (blockId: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled maintenance downtime?')) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const res = await cancelMaintenanceBlockAction(blockId, venueId);
      if (res.success) {
        setSuccessMessage('Maintenance block cancelled.');
      } else {
        setErrorMessage(res.error || 'Failed to cancel maintenance.');
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Maintenance Schedule</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Plan facility downtime, surface repairs, lighting upgrades, or cleaning windows.
          </p>
        </div>
        <Button
          onClick={() => {
            setErrorMessage(null);
            setIsModalOpen(true);
          }}
          size="sm"
          className="flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
          disabled={facilities.length === 0}
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Maintenance</span>
        </Button>
      </div>

      {facilities.length === 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">No facilities available.</span> Please create at least one court or pitch under the <strong>Facilities</strong> tab before scheduling maintenance.
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500 mt-0.5" />
          <p>{errorMessage}</p>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" />
          <p>{successMessage}</p>
        </div>
      )}

      {maintenanceBlocks.length === 0 ? (
        <Card className="text-center py-12 border-dashed border-2 border-slate-200">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Wrench className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No Scheduled Maintenance</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            All facilities are operating normally with no downtime scheduled.
          </p>
          {facilities.length > 0 && (
            <Button
              onClick={() => setIsModalOpen(true)}
              size="sm"
              variant="outline"
              className="inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Maintenance Window</span>
            </Button>
          )}
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Facility / Court</th>
                  <th className="py-3 px-4">Start Time</th>
                  <th className="py-3 px-4">End Time</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {maintenanceBlocks.map((block) => {
                  const facility = facilities.find((f) => f.id === block.facility_id);
                  const startDate = new Date(block.start_at).toLocaleString();
                  const endDate = new Date(block.end_at).toLocaleString();

                  return (
                    <tr key={block.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {facility ? facility.name : 'Unknown Facility'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{startDate}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{endDate}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {block.reason || <span className="text-slate-400 italic">Routine Maintenance</span>}
                      </td>
                      <td className="py-3 px-4">{getMaintenanceBadge(block.status)}</td>
                      <td className="py-3 px-4 text-right">
                        {block.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleCancelBlock(block.id)}
                            disabled={isPending}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-800 py-1 px-2 rounded-lg hover:bg-rose-50 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Cancel Block</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Schedule Maintenance Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Schedule Facility Downtime</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBlock} className="space-y-4 mt-4">
              <div className="space-y-3">
                {/* Target Facility */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Target Facility <span className="text-rose-500">*</span>
                  </label>
                  <select
                    name="facility_id"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy bg-white"
                  >
                    {facilities.map((fac) => (
                      <option key={fac.id} value={fac.id}>
                        {fac.name} ({fac.sport?.name || 'General'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Start Date / Time */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Start Date & Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    name="start_at"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sports-navy"
                  />
                </div>

                {/* End Date / Time */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    End Date & Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    name="end_at"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sports-navy"
                  />
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Maintenance Reason
                  </label>
                  <textarea
                    name="reason"
                    rows={3}
                    placeholder="Surface resurfacing, lighting replacement, deep cleaning..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy resize-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending}
                  className="flex items-center gap-1.5 shadow-xs"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Scheduling...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Schedule Maintenance</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
