'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Users,
  UserPlus,
  Shield,
  Search,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  UserCheck,
  UserX,
  Edit,
  Mail,
} from 'lucide-react';
import type { AppRole, MemberStatus, OrganizationMemberWithProfile } from '@sportshub/types';

interface MembersManagerClientProps {
  initialMembers: OrganizationMemberWithProfile[];
  isReadOnly: boolean;
  currentUserId: string;
}

export function MembersManagerClient({
  initialMembers,
  isReadOnly,
  currentUserId,
}: MembersManagerClientProps) {
  const [members, setMembers] = useState<OrganizationMemberWithProfile[]>(initialMembers);
  const [searchQuery, setSearchQuery] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<OrganizationMemberWithProfile | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Form states
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<AppRole>('MANAGER');
  const [editRole, setEditRole] = useState<AppRole>('MANAGER');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filtered members
  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    const name = m.profile.full_name?.toLowerCase() || '';
    const email = m.profile.email.toLowerCase();
    const role = m.role.toLowerCase();
    return name.includes(q) || email.includes(q) || role.includes(q);
  });

  const managersCount = members.filter((m) => m.role === 'MANAGER').length;
  const receptionistsCount = members.filter((m) => m.role === 'RECEPTIONIST').length;
  const activeCount = members.filter((m) => m.status === 'ACTIVE').length;

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/owner/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          fullName: inviteName || undefined,
          role: inviteRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add member.');
      }

      setMembers((prev) => [...prev, data.member]);
      setSuccessMessage(`Successfully added ${inviteEmail} as ${inviteRole}.`);
      setIsInviteModalOpen(false);
      setInviteEmail('');
      setInviteName('');
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/owner/members/${selectedMember.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: editRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update role.');
      }

      setMembers((prev) =>
        prev.map((m) => (m.id === selectedMember.id ? data.member : m))
      );
      setSuccessMessage(`Updated role for ${selectedMember.profile.full_name} to ${editRole}.`);
      setIsRoleModalOpen(false);
      setSelectedMember(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update role.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (member: OrganizationMemberWithProfile) => {
    if (member.user_id === currentUserId) return;
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const newStatus: MemberStatus = member.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';

    try {
      const res = await fetch(`/api/owner/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update status.');
      }

      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? data.member : m))
      );
      setSuccessMessage(`Updated status for ${member.profile.full_name} to ${newStatus}.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update member status.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!selectedMember) return;
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/owner/members/${selectedMember.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove member.');
      }

      setMembers((prev) => prev.filter((m) => m.id !== selectedMember.id));
      setSuccessMessage(`Removed ${selectedMember.profile.full_name} from the organization.`);
      setIsDeleteModalOpen(false);
      setSelectedMember(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to remove member.');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleBadgeClass = (role: AppRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'OWNER':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'MANAGER':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'RECEPTIONIST':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Messages */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
          <p className="leading-tight">{errorMessage}</p>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" />
          <p className="leading-tight">{successMessage}</p>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-200/80">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Staff
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{members.length}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
            {activeCount} Active
          </div>
        </Card>

        <Card className="p-4 border-slate-200/80">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Managers
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{managersCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Operations Leads</div>
        </Card>

        <Card className="p-4 border-slate-200/80">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Receptionists
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{receptionistsCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Front Desk Staff</div>
        </Card>

        <Card className="p-4 border-slate-200/80">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Other Roles
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {members.length - managersCount - receptionistsCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Owners / Scorers</div>
        </Card>
      </div>

      {/* Action Header & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or role..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all"
          />
        </div>

        {!isReadOnly && (
          <Button
            onClick={() => setIsInviteModalOpen(true)}
            className="w-full sm:w-auto shadow-xs flex items-center justify-center gap-2 text-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Team Member</span>
          </Button>
        )}
      </div>

      {/* Members Table */}
      <Card className="border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Joined Date</th>
                {!isReadOnly && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td
                    colSpan={isReadOnly ? 4 : 5}
                    className="py-8 text-center text-slate-400 font-medium"
                  >
                    No members found matching your search.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const isSelf = member.user_id === currentUserId;
                  const isProtectedRole = member.role === 'SUPER_ADMIN' || member.role === 'OWNER';

                  return (
                    <tr key={member.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-sports-navy/10 text-sports-navy font-bold flex items-center justify-center text-xs shrink-0">
                            {member.profile.full_name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <span>{member.profile.full_name || 'Team Member'}</span>
                              {isSelf && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-slate-400 text-[11px] font-mono">
                              {member.profile.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getRoleBadgeClass(
                            member.role
                          )}`}
                        >
                          <Shield className="w-3 h-3" />
                          <span>{member.role}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            member.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {member.status === 'ACTIVE' ? (
                            <UserCheck className="w-3 h-3" />
                          ) : (
                            <UserX className="w-3 h-3" />
                          )}
                          <span>{member.status}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(member.joined_at || member.created_at).toLocaleDateString()}
                      </td>

                      {!isReadOnly && (
                        <td className="py-3 px-4 text-right">
                          {!isSelf && !isProtectedRole ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                title="Change Role"
                                onClick={() => {
                                  setSelectedMember(member);
                                  setEditRole(
                                    member.role === 'MANAGER' ||
                                      member.role === 'RECEPTIONIST' ||
                                      member.role === 'SCORER' ||
                                      member.role === 'COACH'
                                      ? member.role
                                      : 'MANAGER'
                                  );
                                  setIsRoleModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-sports-navy transition-all"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                title={member.status === 'ACTIVE' ? 'Suspend Member' : 'Activate Member'}
                                onClick={() => handleToggleStatus(member)}
                                className={`p-1.5 rounded-lg transition-all ${
                                  member.status === 'ACTIVE'
                                    ? 'hover:bg-amber-50 text-slate-500 hover:text-amber-700'
                                    : 'hover:bg-emerald-50 text-slate-500 hover:text-emerald-700'
                                }`}
                              >
                                {member.status === 'ACTIVE' ? (
                                  <UserX className="w-3.5 h-3.5" />
                                ) : (
                                  <UserCheck className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <button
                                type="button"
                                title="Remove Member"
                                onClick={() => {
                                  setSelectedMember(member);
                                  setIsDeleteModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Protected</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-sports-accent" />
                <span>Invite Team Member</span>
              </h2>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="staff@royalsports.lk"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Kasun Silva"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Assigned Staff Role <span className="text-rose-500">*</span>
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as AppRole)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy bg-white"
                >
                  <option value="MANAGER">MANAGER (Venues, staff view, operational reports)</option>
                  <option value="RECEPTIONIST">RECEPTIONIST (Front desk bookings, check-ins)</option>
                  <option value="SCORER">SCORER (Live match scoring & court operations)</option>
                  <option value="COACH">COACH (Court reservations & training clinics)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsInviteModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isLoading} className="gap-1.5">
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>Send Invite</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {isRoleModalOpen && selectedMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-slate-900">
              Change Role for {selectedMember.profile.full_name}
            </h2>

            <form onSubmit={handleUpdateRole} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Select New Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as AppRole)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy bg-white"
                >
                  <option value="MANAGER">MANAGER</option>
                  <option value="RECEPTIONIST">RECEPTIONIST</option>
                  <option value="SCORER">SCORER</option>
                  <option value="COACH">COACH</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRoleModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Role'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Member Confirmation Modal */}
      {isDeleteModalOpen && selectedMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-rose-100 text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Remove Staff Member</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to remove <strong>{selectedMember.profile.full_name}</strong> ({selectedMember.profile.email}) from this organization?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-rose-600 text-white hover:bg-rose-700"
                disabled={isLoading}
                onClick={handleDeleteMember}
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm Removal'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
