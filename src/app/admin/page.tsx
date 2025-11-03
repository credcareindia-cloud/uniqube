'use client'

import { useState, useEffect } from 'react'
import { Shield, Users, UserPlus, Edit, Trash2, Search, X, Loader2, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { authenticatedFetch } from '@/utils/authenticatedFetch'
import { toast } from '@/components/ui/use-toast'

interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'user'
  status: 'active' | 'inactive'
  lastLogin?: string
  projects?: number
  createdAt?: string
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [error, setError] = useState('')
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'manager' | 'user'
  })
  const [editUser, setEditUser] = useState<User | null>(null)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const response = await authenticatedFetch('http://localhost:4000/api/admin/users')
      
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      } else {
        console.error('Failed to load users')
      }
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setCreateLoading(true)

    try {
      const response = await authenticatedFetch('http://localhost:4000/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      })

      if (response.ok) {
        await loadUsers()
        setShowCreateModal(false)
        setNewUser({ name: '', email: '', password: '', role: 'user' })
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to create user')
      }
    } catch (error) {
      setError('Error creating user')
      console.error('Error creating user:', error)
    } finally {
      setCreateLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return

    try {
      const response = await authenticatedFetch(`http://localhost:4000/api/admin/users/${userId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await loadUsers()
        toast({
          title: "Success",
          description: "User deleted successfully",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to delete user",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      toast({
        title: "Error",
        description: "Error deleting user",
        variant: "destructive",
      })
    }
  }

  const handleEditUser = (user: User) => {
    setEditUser(user)
    setShowEditModal(true)
    setError('')
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editUser) return

    setError('')
    setEditLoading(true)

    try {
      const response = await authenticatedFetch(`http://localhost:4000/api/admin/users/${editUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editUser.name,
          email: editUser.email,
          role: editUser.role
        })
      })

      if (response.ok) {
        await loadUsers()
        setShowEditModal(false)
        setEditUser(null)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to update user')
      }
    } catch (error) {
      setError('Error updating user')
      console.error('Error updating user:', error)
    } finally {
      setEditLoading(false)
    }
  }

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getRoleBadgeVariant = (role: string): 'destructive' | 'default' | 'secondary' => {
    switch (role) {
      case 'admin': return 'destructive'
      case 'manager': return 'default'
      default: return 'secondary'
    }
  }

  const getStatusBadgeVariant = (status: string): 'success' | 'secondary' => {
    return status === 'active' ? 'success' : 'secondary'
  }

  const stats = [
    { label: 'Total Users', value: users.length, icon: Users },
    { label: 'Active Users', value: users.filter(u => u.status === 'active').length, icon: Users },
    { label: 'Admins', value: users.filter(u => u.role === 'admin').length, icon: Shield },
    { label: 'Managers', value: users.filter(u => u.role === 'manager').length, icon: Users }
  ]

  return (
    <div className="w-full h-full space-y-6">
      {/* Header */}
      <Card className="border-slate-200">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-slate-700">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
                <p className="text-slate-600 text-sm">Manage users and system settings</p>
              </div>
            </div>
            <Button className="w-full lg:w-auto" onClick={() => setShowCreateModal(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <stat.icon className="h-5 w-5 text-slate-700" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
              <div className="text-sm text-slate-600">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users List */}
      <Card className="border-slate-200">
        <CardContent className="p-6">
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-lg font-bold text-slate-900">Users</h2>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-3">
              {filteredUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <Avatar className="h-12 w-12 border-2 border-slate-200">
                      <AvatarImage src={`/avatars/${user.id}.png`} />
                      <AvatarFallback className="bg-slate-700 text-white font-bold">
                        {user.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900 truncate">{user.name}</h3>
                        <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs shrink-0">
                          {user.role}
                        </Badge>
                        <Badge variant={getStatusBadgeVariant(user.status)} className="text-xs shrink-0">
                          {user.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 truncate">{user.email}</p>
                      <p className="text-xs text-slate-500 mt-1">Last login: {user.lastLogin} • {user.projects} projects</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button variant="outline" size="sm" onClick={() => handleEditUser(user)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteUser(user.id)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {filteredUsers.length === 0 && !loading && (
              <div className="text-center py-12">
                <Users className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No users found</h3>
                <p className="text-slate-600 text-sm">Try adjusting your search query</p>
              </div>
            )}

            {loading && (
              <div className="text-center py-12">
                <Loader2 className="h-12 w-12 text-slate-400 mx-auto mb-4 animate-spin" />
                <p className="text-slate-600 text-sm">Loading users...</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">Create New User</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setError('')
                  setNewUser({ name: '', email: '', password: '', role: 'user' })
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-slate-700 font-medium text-sm">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  required
                  className="mt-1"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-slate-700 font-medium text-sm">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                  className="mt-1"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <Label htmlFor="password" className="text-slate-700 font-medium text-sm">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                  minLength={8}
                  className="mt-1"
                  placeholder="Minimum 8 characters"
                />
              </div>

              <div>
                <Label htmlFor="role" className="text-slate-700 font-medium text-sm">Role</Label>
                <select
                  id="role"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'admin' | 'manager' | 'user' })}
                  className="mt-1 w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                >
                  <option value="user">User</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false)
                    setError('')
                    setNewUser({ name: '', email: '', password: '', role: 'user' })
                  }}
                  className="flex-1"
                  disabled={createLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={createLoading}
                >
                  {createLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Create User
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">Edit User</h2>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditUser(null)
                  setError('')
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <Label htmlFor="edit-name" className="text-slate-700 font-medium text-sm">Full Name</Label>
                <Input
                  id="edit-name"
                  type="text"
                  value={editUser.name}
                  onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                  required
                  className="mt-1"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <Label htmlFor="edit-email" className="text-slate-700 font-medium text-sm">Email Address</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editUser.email}
                  onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                  required
                  className="mt-1"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <Label htmlFor="edit-role" className="text-slate-700 font-medium text-sm">Role</Label>
                <select
                  id="edit-role"
                  value={editUser.role}
                  onChange={(e) => setEditUser({ ...editUser, role: e.target.value as 'admin' | 'manager' | 'user' })}
                  className="mt-1 w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                >
                  <option value="user">User</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditUser(null)
                    setError('')
                  }}
                  className="flex-1"
                  disabled={editLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={editLoading}
                >
                  {editLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update User'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
