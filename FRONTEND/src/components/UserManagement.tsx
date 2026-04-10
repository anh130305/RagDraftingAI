import React, { useEffect, useState, useCallback } from 'react';
import { 
  Users, ShieldCheck, Zap, Filter, UserPlus, Search, 
  MoreVertical, Edit2, Trash2, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import * as api from '../lib/api';
import type { UserResponse } from '../lib/api';

const permissions = [
  { 
    role: 'Admin', 
    color: 'primary', 
    items: [
      { label: 'Truy cập Cấu hình Toàn cục', active: true },
      { label: 'Quản lý Thanh toán & Người dùng', active: true },
      { label: 'Triển khai Model', active: true },
    ]
  },
  { 
    role: 'Moderator', 
    color: 'secondary', 
    items: [
      { label: 'Xem Phân tích Toàn cục', active: true },
      { label: 'Dán nhãn dữ liệu', active: true },
      { label: 'Cấu hình Hệ thống', active: false },
    ]
  },
  { 
    role: 'User', 
    color: 'tertiary', 
    items: [
      { label: 'Bảng điều khiển Cá nhân', active: true },
      { label: 'Sử dụng Model và Chat', active: true },
      { label: 'Quản lý Người dùng', active: false },
    ]
  },
];

export default function UserManagement() {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Stats
  const activeCount = users.filter(u => u.is_active).length;
  const adminCount = users.filter(u => u.role === 'admin').length;
  
  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.getAdminUsers(0, 500);
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải danh sách người dùng');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      // Optimistic update
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole as any } : u));
      await api.updateAdminUser(userId, { role: newRole });
    } catch (err: any) {
      alert(err.message || 'Lỗi khi cập nhật vai trò');
      fetchUsers(); // Rollback on error
    }
  };

  const handleStatusToggle = async (userId: string, currentStatus: boolean) => {
    try {
       // Optimistic update
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !currentStatus } : u));
      await api.updateAdminUser(userId, { is_active: !currentStatus });
    } catch (err: any) {
      alert(err.message || 'Lỗi khi cập nhật trạng thái');
      fetchUsers(); // Rollback on error
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-extrabold font-headline tracking-tight text-on-surface mb-1">Quản lý Người dùng & Vai trò</h2>
          <p className="text-xs text-on-surface-variant max-w-2xl font-medium">Theo dõi, phân quyền và quản lý vòng đời tài khoản trên toàn nền tảng RAG AI.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-surface text-on-surface-variant font-bold rounded-xl border border-outline-variant hover:bg-surface-highest transition-colors flex items-center gap-2 text-xs">
            <Filter className="w-4 h-4" />
            Bộ lọc
          </button>
          <button className="px-6 py-2 gradient-primary text-surface font-bold rounded-xl shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center min-w-[120px] text-xs">
            <UserPlus className="w-4 h-4 mr-2" />
            Mời Người dùng
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-xl flex items-center justify-between border border-outline-variant/30">
          <div>
            <p className="text-on-surface-variant text-[10px] uppercase tracking-widest font-bold mb-1">Tổng Thành viên</p>
            <p className="text-3xl font-headline font-extrabold">{users.length}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Users className="w-7 h-7" />
          </div>
        </div>
        <div className="glass-card p-6 rounded-xl flex items-center justify-between border border-outline-variant/30">
          <div>
            <p className="text-on-surface-variant text-[10px] uppercase tracking-widest font-bold mb-1">Đang Hoạt Động</p>
            <p className="text-3xl font-headline font-extrabold">{activeCount}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-green-500">
            <CheckCircle2 className="w-7 h-7" />
          </div>
        </div>
        <div className="glass-card p-6 rounded-xl flex items-center justify-between border border-outline-variant/30">
          <div>
            <p className="text-on-surface-variant text-[10px] uppercase tracking-widest font-bold mb-1">Ban Quản Trị</p>
            <p className="text-3xl font-headline font-extrabold">{adminCount}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-tertiary/10 flex items-center justify-center text-tertiary">
            <ShieldCheck className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden border border-outline-variant/30 shadow-xl">
        <div className="overflow-x-auto custom-scrollbar min-h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-[400px]">
              <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-[400px] text-error font-medium">
               {error}
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-low border-b border-outline-variant/30">
                  <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Người dùng</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Vai trò</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-center">Trạng thái (Active)</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-right">Phòng ban</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-surface-highest/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border border-outline-variant/30 bg-primary/10 flex items-center justify-center text-primary font-bold shadow-inner">
                          {user.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-on-surface">{user.username}</p>
                          <p className="text-[11px] text-on-surface-variant">{user.email || 'Chưa liên kết Email'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="bg-surface-low border-none rounded-lg px-3 py-1.5 text-xs font-bold text-on-surface focus:ring-2 focus:ring-primary focus:outline-none appearance-none cursor-pointer hover:bg-surface-high transition-colors shadow-sm capitalize"
                      >
                        <option value="admin">Admin</option>
                        <option value="moderator">Moderator</option>
                        <option value="user">User</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <button 
                          onClick={() => handleStatusToggle(user.id, user.is_active)}
                          className={cn(
                          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 border shadow-inner",
                          user.is_active ? "bg-primary border-primary/20" : "bg-surface-highest border-outline-variant/50"
                        )}>
                          <span className={cn(
                            "inline-block h-3.5 w-3.5 transform rounded-full bg-surface shadow-sm transition duration-200 ease-in-out",
                            user.is_active ? "translate-x-5" : "translate-x-0.5"
                          )} />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-block px-2 py-1 bg-surface-highest rounded text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                        {user.department || 'Chưa phân bổ'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Pagination Status */}
        <div className="px-6 py-3 bg-surface-low flex items-center justify-between border-t border-outline-variant/30">
          <p className="text-[11px] text-on-surface-variant font-medium">
            Hiển thị tối đa <span className="text-on-surface font-bold">500</span> người dùng gần nhất.
          </p>
          <div className="flex gap-2">
            <button className="p-1.5 rounded border border-outline-variant/50 text-on-surface-variant hover:bg-surface hover:text-on-surface transition-all disabled:opacity-30" disabled>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded border border-outline-variant/50 text-on-surface-variant hover:bg-surface hover:text-on-surface transition-all disabled:opacity-30" disabled>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Permissions Matrix */}
      <div>
        <h3 className="text-xl font-bold font-headline text-on-surface mb-4">Tổng quan Phân quyền (Tham khảo)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {permissions.map((perm) => (
            <div key={perm.role} className="glass-card p-6 rounded-2xl border-t-2 shadow-sm hover:shadow-md transition-shadow" style={{ borderTopColor: `var(--color-${perm.color})` }}>
              <div className="flex items-center gap-3 mb-6">
                <div className={cn("w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]")} style={{ color: `var(--color-${perm.color})`, backgroundColor: 'currentColor' }} />
                <span className="text-xs font-bold tracking-widest uppercase text-on-surface">{perm.role}</span>
              </div>
              <ul className="space-y-4">
                {perm.items.map((item, idx) => (
                  <li key={idx} className={cn("flex items-center gap-3 text-xs transition-opacity font-medium", !item.active && "opacity-40")}>
                    {item.active ? (
                      <CheckCircle2 className="w-4 h-4" style={{ color: `var(--color-${perm.color})` }} />
                    ) : (
                      <XCircle className="w-4 h-4 text-on-surface-variant" />
                    )}
                    <span className="text-on-surface-variant">{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
