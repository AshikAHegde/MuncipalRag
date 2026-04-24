import React, { useState } from 'react';
import { 
  AlertCircle,
  Building2, 
  CheckCircle2, 
  Fingerprint, 
  Loader2, 
  Phone, 
  Save, 
  User as UserIcon 
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';

const ProfilePage = () => {
  const { user, updateProfile } = useAuth();
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    domain: user?.domain || '',
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [status, setStatus] = useState({ type: null, message: '' });

  const VALID_DOMAINS = ["criminal", "civil", "corporate", "tax"];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setStatus({ type: null, message: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isUpdating) return;

    try {
      setIsUpdating(true);
      setStatus({ type: null, message: '' });
      await updateProfile(formData);
      setStatus({ type: 'success', message: 'Profile updated successfully!' });
    } catch (error) {
      setStatus({ 
        type: 'error', 
        message: error.response?.data?.error || 'Failed to update profile.' 
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 flex flex-col h-full min-h-0 overflow-y-auto pr-1">
      <div className="premium-card rounded-xl p-5 dark:border-[#355269] dark:bg-[#1b2c3a]">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-moss-600 text-white dark:bg-[#a9d6f7] dark:text-[#0f2434]">
            <UserIcon size={24} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#6b7280] dark:text-[#a9c3d8]">User Management</p>
            <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#dce8f3]">Account Settings</h2>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Card */}
        <div className="md:col-span-1">
          <div className="premium-card sticky top-0 rounded-xl p-6 text-center dark:border-[#355269] dark:bg-[#1b2c3a]">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-moss-600 bg-moss-50 text-moss-700 dark:border-[#a9d6f7] dark:bg-[#1d3344] dark:text-[#a9d6f7]">
              <Fingerprint size={40} />
            </div>
            <h3 className="mt-4 text-lg font-bold text-[#1a1a1a] dark:text-[#dce8f3]">{user?.fullName}</h3>
            <p className="text-xs uppercase tracking-widest text-[#6b7280] dark:text-[#a9c3d8]">{user?.role} Account</p>
            
            <div className="mt-6 space-y-3 text-left border-t border-[#ebe5dc] pt-6 dark:border-[#355269]">
              <div className="flex items-center gap-3 text-sm">
                <AlertCircle size={14} className="text-[#6b7280]" />
                <span className="text-[#6b7280] dark:text-[#a9c3d8]">Email is immutable</span>
              </div>
              <p className="px-7 text-sm font-medium text-[#1a1a1a] dark:text-[#dce8f3] truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="md:col-span-2">
          <div className="premium-card rounded-xl p-6 dark:border-[#355269] dark:bg-[#1b2c3a]">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#1a1a1a] dark:text-[#dce8f3]">Full Name</label>
                  <div className="premium-input flex items-center gap-3 rounded-lg px-3 py-2 dark:bg-[#1d3344]">
                    <UserIcon size={16} className="text-[#6b7280]" />
                    <input 
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      required
                      className="bg-transparent text-sm w-full outline-none placeholder:text-[#8a8f99] dark:text-[#dce8f3]"
                      placeholder="Enter your name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#1a1a1a] dark:text-[#dce8f3]">Phone Number</label>
                  <div className="premium-input flex items-center gap-3 rounded-lg px-3 py-2 dark:bg-[#1d3344]">
                    <Phone size={16} className="text-[#6b7280]" />
                    <input 
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="bg-transparent text-sm w-full outline-none placeholder:text-[#8a8f99] dark:text-[#dce8f3]"
                      placeholder="+91 00000 00000"
                    />
                  </div>
                </div>
              </div>

              {user?.role === 'lawyer' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#1a1a1a] dark:text-[#dce8f3]">Legal Practice Domain</label>
                  <div className="premium-input flex items-center gap-3 rounded-lg px-3 py-2 dark:bg-[#1d3344]">
                    <Building2 size={16} className="text-[#6b7280]" />
                    <select
                      name="domain"
                      value={formData.domain}
                      onChange={handleChange}
                      required
                      className="bg-transparent text-sm w-full outline-none dark:text-[#dce8f3]"
                    >
                      <option value="" disabled className="dark:bg-[#1d3344]">Select professional domain</option>
                      {VALID_DOMAINS.map((domain) => (
                        <option key={domain} value={domain} className="dark:bg-[#1d3344] capitalize">
                          {domain}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {status.message && (
                <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
                  status.type === 'success' 
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200'
                    : 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200'
                }`}>
                  {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {status.message}
                </div>
              )}

              <div className="flex justify-end border-t border-[#ebe5dc] pt-6 dark:border-[#355269]">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="premium-btn-primary flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition disabled:opacity-50"
                >
                  {isUpdating ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
