'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { FacilityFormModal } from './FacilityFormModal';
import { Plus, Edit2, Layers, Users, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import type { FacilityWithSport, VenueSportWithSport, FacilityStatus } from '@sportshub/types';

interface FacilityListProps {
  venueId: string;
  facilities: FacilityWithSport[];
  venueSports: VenueSportWithSport[];
}

function getStatusBadge(status: FacilityStatus) {
  switch (status) {
    case 'AVAILABLE':
      return <Badge variant="success">AVAILABLE</Badge>;
    case 'MAINTENANCE':
      return <Badge variant="warning">MAINTENANCE</Badge>;
    case 'BLOCKED':
      return <Badge variant="error">BLOCKED</Badge>;
    case 'CLOSED':
      return <Badge variant="default">CLOSED</Badge>;
    case 'ARCHIVED':
      return <Badge variant="default">ARCHIVED</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function FacilityList({ venueId, facilities, venueSports }: FacilityListProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<FacilityWithSport | null>(null);

  const activeVenueSports = venueSports.filter((vs) => vs.is_active);

  const handleCreate = () => {
    setSelectedFacility(null);
    setModalOpen(true);
  };

  const handleEdit = (facility: FacilityWithSport) => {
    setSelectedFacility(facility);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Facilities & Courts</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure courts, pitches, pitches, and physical sporting spaces within this venue.
          </p>
        </div>
        <Button onClick={handleCreate} size="sm" className="flex items-center gap-1.5 self-start sm:self-auto shadow-xs">
          <Plus className="w-4 h-4" />
          <span>Add Facility</span>
        </Button>
      </div>

      {activeVenueSports.length === 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">No active sports configured yet.</span> Before adding specific sport courts, assign and enable sports in the <strong>Venue Sports</strong> tab.
          </div>
        </div>
      )}

      {facilities.length === 0 ? (
        <Card className="text-center py-12 border-dashed border-2 border-slate-200">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No Facilities Added Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Add courts, turf pitches, lanes, or practice areas to start managing this venue.
          </p>
          <Button onClick={handleCreate} size="sm" variant="outline" className="inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            <span>Create First Facility</span>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {facilities.map((fac) => (
            <Card key={fac.id} className="p-4 flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate" title={fac.name}>
                      {fac.name}
                    </h3>
                    <p className="text-[11px] font-mono text-slate-400 truncate">/{fac.slug}</p>
                  </div>
                  {getStatusBadge(fac.status)}
                </div>

                <div className="space-y-1.5 my-3 text-xs text-slate-600">
                  <div className="flex items-center justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-400">Sport</span>
                    <span className="font-semibold text-slate-800">
                      {fac.sport ? fac.sport.name : 'Multi-sport / Generic'}
                    </span>
                  </div>

                  {fac.facility_type && (
                    <div className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-400">Surface / Type</span>
                      <span className="text-slate-700">{fac.facility_type}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Users className="w-3 h-3" /> Capacity
                    </span>
                    <span className="text-slate-700">{fac.capacity ? `${fac.capacity} players` : 'Flexible'}</span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Duration / Buffer
                    </span>
                    <span className="text-slate-700">
                      {fac.default_duration_minutes}m ({fac.buffer_minutes}m buf)
                    </span>
                  </div>
                </div>

                {fac.description && (
                  <p className="text-xs text-slate-500 line-clamp-2 mt-2 pt-2 border-t border-slate-50">
                    {fac.description}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-3">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  {fac.is_bookable ? 'Bookable' : 'Internal Only'}
                </span>
                <Button
                  onClick={() => handleEdit(fac)}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs flex items-center gap-1 px-2.5"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit</span>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <FacilityFormModal
        venueId={venueId}
        facility={selectedFacility}
        activeVenueSports={activeVenueSports}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
