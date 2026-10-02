'use client';

import React, { useState, useTransition } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { createPricingRuleAction, deletePricingRuleAction } from '@/lib/owner/actions';
import {
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  DollarSign,
  X,
  Save,
  CheckCircle2,
  Tag,
} from 'lucide-react';
import type { PricingRule, FacilityWithSport, PricingType } from '@sportshub/types';

interface PricingRulesManagerProps {
  venueId: string;
  pricingRules: PricingRule[];
  facilities: FacilityWithSport[];
  currency?: string;
}

const PRICING_TYPES: { value: PricingType; label: string }[] = [
  { value: 'BASE', label: 'Base Rate' },
  { value: 'PEAK', label: 'Peak Hours' },
  { value: 'OFF_PEAK', label: 'Off-Peak Discount' },
  { value: 'WEEKEND', label: 'Weekend Rate' },
  { value: 'MEMBER', label: 'Member Exclusive' },
  { value: 'HOLIDAY', label: 'Holiday Special' },
  { value: 'CUSTOM', label: 'Custom Tier' },
];

const DAY_OPTIONS = [
  { value: '', label: 'All Days (Default)' },
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

function getPricingTypeBadge(type: PricingType) {
  switch (type) {
    case 'BASE':
      return <Badge variant="default">BASE</Badge>;
    case 'PEAK':
      return <Badge variant="warning">PEAK</Badge>;
    case 'OFF_PEAK':
      return <Badge variant="info">OFF-PEAK</Badge>;
    case 'WEEKEND':
      return <Badge variant="success">WEEKEND</Badge>;
    case 'MEMBER':
      return <Badge variant="info">MEMBER</Badge>;
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
}

export function PricingRulesManager({
  venueId,
  pricingRules,
  facilities,
  currency = 'LKR',
}: PricingRulesManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCreateRule = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const formData = new FormData(e.currentTarget);
    formData.append('venue_id', venueId);

    startTransition(async () => {
      const res = await createPricingRuleAction(null, formData);
      if (res.success) {
        setIsModalOpen(false);
        setSuccessMessage('Pricing rule added successfully.');
      } else {
        setErrorMessage(res.error || 'Failed to create pricing rule.');
      }
    });
  };

  const handleDeleteRule = (ruleId: string) => {
    if (!confirm('Are you sure you want to remove this pricing rule?')) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const res = await deletePricingRuleAction(ruleId, venueId);
      if (res.success) {
        setSuccessMessage('Pricing rule removed.');
      } else {
        setErrorMessage(res.error || 'Failed to remove pricing rule.');
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Pricing Rules & Rate Tiers</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure hourly rates, peak/off-peak pricing, and court-specific overrides.
          </p>
        </div>
        <Button
          onClick={() => {
            setErrorMessage(null);
            setIsModalOpen(true);
          }}
          size="sm"
          className="flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Pricing Rule</span>
        </Button>
      </div>

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

      {pricingRules.length === 0 ? (
        <Card className="text-center py-12 border-dashed border-2 border-slate-200">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <DollarSign className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No Pricing Rules Defined</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Set up base rates and hourly pricing rules for courts and facilities at this venue.
          </p>
          <Button
            onClick={() => setIsModalOpen(true)}
            size="sm"
            variant="outline"
            className="inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Pricing Rule</span>
          </Button>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Rule Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Scope / Facility</th>
                  <th className="py-3 px-4">Schedule / Hours</th>
                  <th className="py-3 px-4 text-right">Standard Rate</th>
                  <th className="py-3 px-4 text-right">Member Rate</th>
                  <th className="py-3 px-4 text-center">Priority</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pricingRules.map((rule) => {
                  const targetFacility = facilities.find((f) => f.id === rule.facility_id);
                  const dayText =
                    rule.day_of_week !== null && rule.day_of_week !== undefined
                      ? DAY_OPTIONS.find((d) => d.value === String(rule.day_of_week))?.label || 'All Days'
                      : 'All Days';

                  const timeWindow =
                    rule.start_time && rule.end_time
                      ? `${rule.start_time.slice(0, 5)} - ${rule.end_time.slice(0, 5)}`
                      : 'All Day';

                  return (
                    <tr key={rule.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-slate-400" />
                          <span>{rule.name}</span>
                          {!rule.is_active && (
                            <Badge variant="default" className="text-[10px]">Disabled</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">{getPricingTypeBadge(rule.pricing_type)}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {targetFacility ? (
                          <span className="font-medium text-slate-800">{targetFacility.name}</span>
                        ) : (
                          <span className="text-slate-400 italic">All Facilities (Venue-wide)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        <div>{dayText}</div>
                        <div className="text-slate-400 text-[10px]">{timeWindow}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {currency} {Number(rule.price_per_hour).toFixed(2)}/hr
                      </td>
                      <td className="py-3 px-4 text-right text-slate-700">
                        {rule.member_price !== null && rule.member_price !== undefined ? (
                          <span className="font-semibold text-emerald-600">
                            {currency} {Number(rule.member_price).toFixed(2)}/hr
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-500">
                        {rule.priority}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          disabled={isPending}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Pricing Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add Pricing Rule</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Rule Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Rule Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="e.g. Standard Peak Hours"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy"
                  />
                </div>

                {/* Pricing Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Pricing Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    name="pricing_type"
                    required
                    defaultValue="BASE"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy bg-white"
                  >
                    {PRICING_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Facility Scope */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Facility Scope
                  </label>
                  <select
                    name="facility_id"
                    defaultValue=""
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy bg-white"
                  >
                    <option value="">All Facilities (Venue-wide)</option>
                    {facilities.map((fac) => (
                      <option key={fac.id} value={fac.id}>
                        {fac.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Price Per Hour */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Rate / Hour ({currency}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="price_per_hour"
                    step="0.01"
                    min="0"
                    required
                    placeholder="1500.00"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy"
                  />
                </div>

                {/* Member Price */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Member Rate / Hour ({currency})
                  </label>
                  <input
                    type="number"
                    name="member_price"
                    step="0.01"
                    min="0"
                    placeholder="1200.00"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy"
                  />
                </div>

                {/* Day of Week */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Day of Week
                  </label>
                  <select
                    name="day_of_week"
                    defaultValue=""
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy bg-white"
                  >
                    {DAY_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Rule Priority
                  </label>
                  <input
                    type="number"
                    name="priority"
                    defaultValue={0}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Higher priority overrides base rules</p>
                </div>

                {/* Start Time */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    name="start_time"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sports-navy"
                  />
                </div>

                {/* End Time */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    name="end_time"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sports-navy"
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
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Create Pricing Rule</span>
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
