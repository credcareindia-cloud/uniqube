import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Users, UserPlus, Edit, Trash2, Search, X, Loader2, AlertCircle, FolderOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { api } from '@/services/api';
import type { Project, User, ProjectMember } from '@/services/api';
import { toast } from '@/components/ui/use-toast';
import { useRBAC } from '@/contexts/RBACContext';

interface ProjectMembershipManagerProps {
  onClose: () => void;
}

export const ProjectMembershipManager: React.FC<ProjectMembershipManagerProps> = ({ onClose }) => {
  const { refreshUserProjects } = useRBAC();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<Array<User & { assigned: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [addMemberLoading, setAddMemberLoading] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadProjectMembers(selectedProject.id);
      loadAssignableUsers(selectedProject.id);
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    try {
      const response = await api.getAllProjects();
      setProjects(response.projects);
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast({
        title: "Error",
        description: "Failed to load projects",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAssignableUsers = async (projectId: string) => {
    try {
      setUsersLoading(true);
      const response = await api.getAssignableUsers(projectId);
      setAssignableUsers(response.users);
    } catch (error) {
      console.error('Failed to load assignable users:', error);
      toast({
        title: "Error",
        description: "Failed to load assignable users",
        variant: "destructive",
      });
    } finally {
      setUsersLoading(false);
    }
  };

  const loadProjectMembers = async (projectId: string) => {
    try {
      setMembersLoading(true);
      const response = await api.getProjectMembers(projectId);
      setMembers(response.members);
    } catch (error) {
      console.error('Failed to load project members:', error);
      toast({
        title: "Error",
        description: "Failed to load project members",
        variant: "destructive",
      });
    } finally {
      setMembersLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !selectedUser) return;

    setAddMemberLoading(true);
    try {
      const userRole = assignableUsers.find(u => u.id === selectedUser)?.role || 'VIEWER';
      await api.addProjectMember(selectedProject.id, selectedUser, userRole as 'MANAGER' | 'VIEWER');
      await loadProjectMembers(selectedProject.id);
      await refreshUserProjects();
      setShowAddMemberModal(false);
      setSelectedUser('');
      toast({
        title: "Success",
        description: "Member added successfully",
      });
    } catch (error) {
      console.error('Failed to add member:', error);
      toast({
        title: "Error",
        description: "Failed to add member",
        variant: "destructive",
      });
    } finally {
      setAddMemberLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedProject) return;
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      await api.removeProjectMember(selectedProject.id, userId);
      await loadProjectMembers(selectedProject.id);
      await refreshUserProjects();
      toast({
        title: "Success",
        description: "Member removed successfully",
      });
    } catch (error) {
      console.error('Failed to remove member:', error);
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
    }
  };

  const getRoleBadgeVariant = (role: string): 'destructive' | 'default' | 'secondary' => {
    switch (role) {
      case 'MANAGER': return 'destructive';
      default: return 'secondary';
    }
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const unassignedUsers = assignableUsers.filter(user => !user.assigned && user.role !== 'ADMIN');

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-slate-900">Project Membership Manager</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Projects List */}
          <div className="w-1/3 border-r p-6 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Projects</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-48"
                  />
                </div>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 text-slate-400 mx-auto mb-2 animate-spin" />
                  <p className="text-slate-600 text-sm">Loading projects...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredProjects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => setSelectedProject(project)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedProject?.id === project.id
                          ? 'bg-slate-100 border-slate-300'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <FolderOpen className="h-5 w-5 text-slate-500" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-slate-900 truncate">{project.name}</h4>
                          <p className="text-xs text-slate-500 truncate">{project.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Members List */}
          <div className="flex-1 p-6 overflow-y-auto">
            {selectedProject ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">Members of {selectedProject.name}</h3>
                    <p className="text-sm text-slate-600">{members.length} members</p>
                  </div>
                  <Button onClick={() => setShowAddMemberModal(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Member
                  </Button>
                </div>

                {membersLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 text-slate-400 mx-auto mb-2 animate-spin" />
                    <p className="text-slate-600 text-sm">Loading members...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="flex items-center gap-4 flex-1">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={`/avatars/${member.user.id}.png`} />
                            <AvatarFallback className="bg-slate-700 text-white font-bold">
                              {member.user.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <h4 className="font-medium text-slate-900">{member.user.name}</h4>
                            <p className="text-sm text-slate-600">{member.user.email}</p>
                          </div>
                          <Badge variant={member.user.role === 'MANAGER' ? 'destructive' : 'secondary'} className="text-xs">
                            {member.user.role}
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveMember(member.userId)}
                          className="ml-2"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <FolderOpen className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Select a Project</h3>
                <p className="text-slate-600 text-sm">Choose a project from the left to manage its members</p>
              </div>
            )}
          </div>
        </div>

        {/* Add Member Modal */}
        {showAddMemberModal && createPortal(
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900">Add Member</h3>
                <button
                  onClick={() => setShowAddMemberModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAddMember} className="space-y-4">
                <div>
                  <Label htmlFor="user" className="text-slate-700 font-medium text-sm">Select User</Label>
                  <p className="text-xs text-slate-500 mb-2">User will be assigned with their organization role</p>
                  {usersLoading ? (
                    <div className="mt-1 p-3 bg-slate-50 border border-slate-300 rounded-lg text-center">
                      <p className="text-slate-600 text-sm">Loading users...</p>
                    </div>
                  ) : (
                    <select
                      id="user"
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      required
                      className="mt-1 w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    >
                      <option value="">Select a user</option>
                      {unassignedUsers.length > 0 ? (
                        unassignedUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} ({user.email}) - {user.role}
                          </option>
                        ))
                      ) : (
                        <option disabled>No unassigned users available</option>
                      )}
                    </select>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddMemberModal(false)}
                    className="flex-1"
                    disabled={addMemberLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={addMemberLoading || !selectedUser}
                  >
                    {addMemberLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      'Add Member'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>,
    document.body
  );
};