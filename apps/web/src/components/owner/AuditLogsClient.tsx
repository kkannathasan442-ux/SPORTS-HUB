'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  History,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  Shield,
  Clock,
  Calendar,
  Layers,
  User,
  Activity,
  X,
  FileCode,
} from 'lucide-react';
import type { AuditLogWithActor } from '@sportshub/types';

interface AuditLogsClientProps {
  initialLogs: AuditLogWithActor[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  organizationId: string;
}

export function AuditLogsClient({
  initialLogs,
  totalCount,
  currentPage,
  pageSize,
  totalPages,
}: AuditLogsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedLog, setSelectedLog] = useState<AuditLogWithActor | null>(null);

  // Filters state
  const [actionFilter, setActionFilter] = useState(searchParams.get('action') || '');
  const [entityFilter, setEntityFilter] = useState(searchParams.get('entityType') || '');
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();

    if (actionFilter) params.set('action', actionFilter);
    if (entityFilter) params.set('entityType', entityFilter);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    params.set('page', '1');

    router.push(`/owner/audit-logs?${params.toString()}`);
  };

  const handleClearFilters = () => {
    setActionFilter('');
    setEntityFilter('');
    setStartDate('');
    setEndDate('');
    router.push('/owner/audit-logs');
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/owner/audit-logs?${params.toString()}`);
  };

  const getActionBadge = (action: string) => {
    if (action.includes('SETTINGS') || action.includes('PROFILE')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (action.includes('MEMBER')) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
    if (action.includes('VENUE') || action.includes('FACILITY')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (action.includes('PRICING') || action.includes('MAINTENANCE')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (action.includes('REFUND') || action.includes('PAYMENT')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <Card className="p-4 border-slate-200/80 shadow-xs">
        <form onSubmit={handleApplyFilters} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Audit Action
            </label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sports-navy text-xs"
            >
              <option value="">All Actions</option>
              <option value="ORGANIZATION_PROFILE_UPDATED">ORGANIZATION_PROFILE_UPDATED</option>
              <option value="ORGANIZATION_SETTINGS_UPDATED">ORGANIZATION_SETTINGS_UPDATED</option>
              <option value="MEMBER_INVITED">MEMBER_INVITED</option>
              <option value="MEMBER_ROLE_UPDATED">MEMBER_ROLE_UPDATED</option>
              <option value="MEMBER_STATUS_UPDATED">MEMBER_STATUS_UPDATED</option>
              <option value="MEMBER_REMOVED">MEMBER_REMOVED</option>
              <option value="VENUE_CREATED">VENUE_CREATED</option>
              <option value="VENUE_UPDATED">VENUE_UPDATED</option>
              <option value="FACILITY_CREATED">FACILITY_CREATED</option>
              <option value="PRICING_RULE_CREATED">PRICING_RULE_CREATED</option>
              <option value="MAINTENANCE_BLOCK_CREATED">MAINTENANCE_BLOCK_CREATED</option>
              <option value="REFUND_APPROVED">REFUND_APPROVED</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Entity Type
            </label>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sports-navy text-xs"
            >
              <option value="">All Entities</option>
              <option value="organizations">organizations</option>
              <option value="organization_members">organization_members</option>
              <option value="venues">venues</option>
              <option value="facilities">facilities</option>
              <option value="pricing_rules">pricing_rules</option>
              <option value="maintenance_blocks">maintenance_blocks</option>
              <option value="bookings">bookings</option>
              <option value="refund_records">refund_records</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sports-navy text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sports-navy text-xs"
            />
          </div>

          <div className="flex items-end gap-2">
            <Button type="submit" size="sm" className="w-full gap-1.5 text-xs">
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              className="text-xs px-2.5"
              title="Clear Filters"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </form>
      </Card>

      {/* Logs Table */}
      <Card className="border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4 text-right">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {initialLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                    <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No audit records match the selected criteria.
                  </td>
                </tr>
              ) : (
                initialLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-sports-navy/10 text-sports-navy font-bold flex items-center justify-center text-[10px] shrink-0">
                          {log.actor?.full_name?.charAt(0).toUpperCase() || 'A'}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 block truncate max-w-[140px]">
                            {log.actor?.full_name || 'System Admin'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block truncate max-w-[140px]">
                            {log.actor?.email || log.actor_user_id.slice(0, 8)}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${getActionBadge(
                          log.action
                        )}`}
                      >
                        <Activity className="w-2.5 h-2.5" />
                        <span>{log.action}</span>
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-mono text-[11px] text-slate-700">
                        <span className="font-semibold text-slate-900">{log.entity_type}</span>
                        {log.entity_id && (
                          <span className="text-slate-400 block text-[10px]">
                            ID: {log.entity_id.slice(0, 8)}...
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                        className="text-xs gap-1 text-sports-navy hover:bg-sports-navy/10 h-7 px-2"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold">{initialLogs.length}</span> of{' '}
            <span className="font-semibold">{totalCount}</span> entries
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
              className="h-8 px-2.5"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-medium px-2">
              Page {currentPage} of {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              className="h-8 px-2.5"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Inspect Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-sports-accent" />
                <h2 className="text-base font-bold text-slate-900">
                  Audit Event Details
                </h2>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 text-xs overflow-y-auto pr-1">
              {/* Event Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block font-medium">Action</span>
                  <span className="font-bold text-slate-800">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Actor</span>
                  <span className="font-semibold text-slate-800">
                    {selectedLog.actor?.full_name || selectedLog.actor_user_id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Timestamp</span>
                  <span className="font-mono text-slate-700">
                    {new Date(selectedLog.created_at).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Entity Type</span>
                  <span className="font-mono text-slate-800">{selectedLog.entity_type}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400 block font-medium">Entity ID</span>
                  <span className="font-mono text-slate-700 text-[11px]">
                    {selectedLog.entity_id || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Before Data */}
              {selectedLog.before_data && (
                <div>
                  <h3 className="font-semibold text-slate-700 mb-1">Previous State (Before)</h3>
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-x-auto">
                    {JSON.stringify(selectedLog.before_data, null, 2)}
                  </pre>
                </div>
              )}

              {/* After Data */}
              {selectedLog.after_data && (
                <div>
                  <h3 className="font-semibold text-slate-700 mb-1">New State (After)</h3>
                  <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto">
                    {JSON.stringify(selectedLog.after_data, null, 2)}
                  </pre>
                </div>
              )}

              {/* Metadata */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-700 mb-1">Event Metadata</h3>
                  <pre className="p-3 bg-slate-100 text-slate-800 rounded-xl font-mono text-[11px] overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <Button size="sm" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
