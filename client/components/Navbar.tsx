import React, { useState, useRef, useEffect } from 'react';
import { useDialog } from '../hooks/useDialog';
import { useOnlineUsers } from '../hooks/useOnlineUsers';
import { useSocket } from '../contexts/SocketContext';
import { AlertDialog } from './AlertDialog';
import { apiUrl } from '../config';
import { NotificationDropdown } from './NotificationDropdown';

interface NavbarProps {
  onOpenRegister?: () => void;
  onOpenLogin: () => void;
  currentUser: any;
  onLogout?: () => void;
  onUserUpdated?: (user: any) => void;
}

// Helper function for gradient colors
const getGradientForName = (name: string): string => {
  const gradients = [
    'from-blue-400 to-blue-500',
    'from-purple-400 to-purple-500',
    'from-pink-400 to-pink-500',
    'from-green-400 to-green-500',
    'from-orange-400 to-orange-500',
    'from-red-400 to-red-500',
    'from-teal-400 to-teal-500',
    'from-indigo-400 to-indigo-500'
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return gradients[hash % gradients.length];
};

export const Navbar: React.FC<NavbarProps> = ({ onOpenRegister, onOpenLogin, currentUser, onLogout, onUserUpdated }) => {
  // Get online users from Socket.IO context
  const onlineUsers = useOnlineUsers();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const { alertState, showAlert, hideAlert } = useDialog();
  const { socket } = useSocket();

  // Listen for live updates to current user (e.g. stars granted)
  useEffect(() => {
    if (!socket || !currentUser || !onUserUpdated) return;

    const handleTaskCompleted = async (data: { userId: number }) => {
      if (Number(data.userId) === Number(currentUser.id)) {
        try {
          const res = await fetch(apiUrl('/me'), { credentials: 'include' });
          if (res.ok) {
            const json = await res.json();
            onUserUpdated(json.user);
          }
        } catch (e) {
          console.error('[Navbar] Failed to refresh user data:', e);
        }
      }
    };

    socket.on('task:completed', handleTaskCompleted);

    return () => {
      socket.off('task:completed', handleTaskCompleted);
    };
  }, [socket, currentUser, onUserUpdated]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!showProfileModal) return;
    setProfileName(currentUser?.name || '');
    setSelectedAvatarFile(null);
    setAvatarPreviewUrl(null);
    setAvatarError(null);
  }, [showProfileModal, currentUser]);

  useEffect(() => {
    if (!selectedAvatarFile) return;
    setAvatarError(null);
    const url = URL.createObjectURL(selectedAvatarFile);
    setAvatarPreviewUrl(url);
    // Validate image resolution to avoid pixelated avatars
    const img = new Image();
    img.onload = () => {
      const minSize = 256;
      if ((img.naturalWidth || 0) < minSize || (img.naturalHeight || 0) < minSize) {
        setAvatarError(`Imaginea este prea mică (${img.naturalWidth}x${img.naturalHeight}). Te rog încarcă una de minim ${minSize}x${minSize} pentru calitate bună.`);
      }
    };
    img.onerror = () => {
      setAvatarError('Nu am putut citi imaginea. Te rog încearcă alt fișier.');
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [selectedAvatarFile]);

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    const name = profileName.trim();
    if (name.length < 2) return;
    if (avatarError) return;

    setSavingProfile(true);
    try {
      let avatarUrl = currentUser.avatar_url || null;

      if (selectedAvatarFile) {
        const formData = new FormData();
        formData.append('image', selectedAvatarFile);
        const uploadRes = await fetch(apiUrl('/upload-image'), {
          method: 'POST',
          credentials: 'include',
          body: formData
        });
        if (!uploadRes.ok) {
          throw new Error('Failed to upload avatar');
        }
        const uploadData = await uploadRes.json();
        avatarUrl = uploadData.url;
      }

      const res = await fetch(apiUrl('/me'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, avatar_url: avatarUrl })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to update profile');
      }

      const data = await res.json();
      if (onUserUpdated) onUserUpdated(data.user);
      setShowProfileModal(false);
    } catch (e: any) {
      console.error(e);
      showAlert('Error', e?.message || 'Failed to update profile', 'danger');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <>
      <AlertDialog
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        variant={alertState.variant}
        onConfirm={hideAlert}
      />

      <nav class="bg-card-light dark:bg-card-dark border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex justify-between items-center sticky top-0 z-50">
        <div class="flex items-center">
          <a href="#" class="text-3xl font-extrabold italic text-primary hover:text-primary-dark transition-colors">
            Learning
          </a>
        </div>

        <div class="flex items-center space-x-6">
          {!currentUser ? (
            <button
              onClick={onOpenLogin}
              class="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-colors"
            >
              Authentication
            </button>
          ) : (
            <div class="flex items-center space-x-6">
              {/* Online Users - exclude current user */}
              {onlineUsers.filter(u => u.id !== currentUser.id).length > 0 && (
                <div class="flex items-center space-x-3">
                  <span class="text-sm font-semibold text-gray-600 dark:text-gray-400">Online:</span>
                  <div class="flex items-center -space-x-2">
                    {onlineUsers.filter(u => u.id !== currentUser.id).slice(0, 8).map((user) => {
                      const initial = user.name.charAt(0).toUpperCase();
                      return (
                        <div
                          key={user.id}
                          class="relative group z-0 hover:z-20"
                          title={user.name}
                        >
                          <div class="w-7 h-7 rounded-full overflow-hidden border-2 border-green-500 shadow-sm transition-transform hover:scale-125 cursor-pointer bg-white">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt={user.name} class="w-full h-full object-cover" />
                            ) : (
                              <div class={`w-full h-full bg-gradient-to-br ${getGradientForName(user.name)} flex items-center justify-center font-bold text-white text-[0.65rem]`}>
                                {initial}
                              </div>
                            )}
                          </div>
                          {/* Tooltip */}
                          <div class="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                            {user.name}
                          </div>
                        </div>
                      );
                    })}
                    {onlineUsers.filter(u => u.id !== currentUser.id).length > 8 && (
                      <div class="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center font-bold text-gray-600 dark:text-gray-300 text-[0.55rem] shadow-sm">
                        +{onlineUsers.filter(u => u.id !== currentUser.id).length - 8}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notification Bell */}
              <NotificationDropdown currentUser={currentUser} />

              {/* User Info with Dropdown */}
              <div class="relative" ref={menuRef}>
                <div
                  class="flex items-center space-x-3 border-l border-gray-300 dark:border-gray-600 pl-6 pr-3 py-1 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  {/* Avatar */}
                  <div class="w-10 h-10 rounded-full bg-gradient-to-br from-orange-300 to-orange-400 flex items-center justify-center font-bold text-white text-base shadow-md overflow-hidden">
                    {currentUser.avatar_url ? (
                      <img src={currentUser.avatar_url} alt="avatar" class="w-full h-full object-cover" />
                    ) : (
                      currentUser.name.charAt(0)
                    )}
                  </div>

                  {/* Name and Role/Stars */}
                  <div class="flex flex-col items-start leading-tight">
                    <span class="font-bold text-gray-900 dark:text-white text-base">{currentUser.name}</span>
                    {currentUser.role === 'admin' ? (
                      <span class="text-gray-500 dark:text-gray-400 text-xs">Administrator</span>
                    ) : (
                      <div class="flex items-center text-yellow-400 font-bold text-xs">
                        <span>{currentUser.stars || 0}</span>
                        <span class="material-icons text-sm ml-0.5">stars</span>
                      </div>
                    )}
                  </div>

                  {/* Dropdown Arrow */}
                  <span class={`material-icons text-gray-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </div>

                {/* Dropdown Menu */}
                {showUserMenu && (
                  <div class="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 z-50">
                    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                      <p class="text-sm font-bold text-gray-900 dark:text-white">{currentUser.name}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{currentUser.email}</p>
                    </div>

                    <button
                      class="w-full px-4 py-3 text-left flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => {
                        setShowUserMenu(false);
                        setShowProfileModal(true);
                      }}
                    >
                      <span class="material-icons text-gray-600 dark:text-gray-400">person</span>
                      <span class="text-sm text-gray-700 dark:text-gray-300">Edit Profile</span>
                    </button>

                    <button
                      class="w-full px-4 py-3 text-left flex items-center space-x-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600"
                      onClick={() => {
                        setShowUserMenu(false);
                        if (onLogout) onLogout();
                      }}
                    >
                      <span class="material-icons">logout</span>
                      <span class="text-sm font-medium">Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Edit Profile Modal */}
      {currentUser && showProfileModal && (
        <div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => !savingProfile && setShowProfileModal(false)}>
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-[560px] p-8 border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-2xl font-bold text-gray-900 dark:text-white">Edit Profile</h3>
              <button class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" onClick={() => !savingProfile && setShowProfileModal(false)}>
                <span class="material-icons">close</span>
              </button>
            </div>

            <div class="flex items-center space-x-5 mb-6">
              <div class="relative">
                <div
                  class="w-20 h-20 rounded-full bg-gradient-to-br from-orange-300 to-orange-400 shadow-lg overflow-hidden flex items-center justify-center cursor-pointer border-2 border-white"
                  onClick={() => avatarInputRef.current?.click()}
                  title="Change photo"
                >
                  {(avatarPreviewUrl || currentUser.avatar_url) ? (
                    <img src={avatarPreviewUrl || currentUser.avatar_url} alt="avatar" class="w-full h-full object-cover" />
                  ) : (
                    <span class="text-white font-extrabold text-2xl">{currentUser.name?.charAt(0)}</span>
                  )}
                </div>
                <button
                  class="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-md hover:bg-primary-dark transition-colors"
                  onClick={() => avatarInputRef.current?.click()}
                  type="button"
                >
                  <span class="material-icons text-base">photo_camera</span>
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  class="hidden"
                  onChange={(e) => setSelectedAvatarFile(e.target.files?.[0] || null)}
                />
              </div>

              <div class="flex-1">
                <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">Email</div>
                <div class="font-bold text-gray-800 dark:text-gray-200">{currentUser.email}</div>

                {currentUser.role !== 'admin' && (
                  <div class="mt-3 flex items-center text-yellow-400 font-bold">
                    <span class="mr-2">Stars:</span>
                    <span class="mr-1">{currentUser.stars || 0}</span>
                    <span class="material-icons text-base">stars</span>
                  </div>
                )}
              </div>
            </div>

            {avatarError && (
              <div class="mb-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
                {avatarError}
              </div>
            )}

            <div class="mb-6">
              <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Name</label>
              <input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                class="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary"
                placeholder="Your name"
              />
              {profileName.trim().length > 0 && profileName.trim().length < 2 && (
                <div class="text-xs text-red-500 mt-2">Name must be at least 2 characters.</div>
              )}
            </div>

            <div class="flex justify-end space-x-3">
              <button
                class="px-5 py-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                onClick={() => !savingProfile && setShowProfileModal(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                class={`px-5 py-2 rounded-lg font-bold text-white transition-colors ${savingProfile || profileName.trim().length < 2 || !!avatarError ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-primary-dark'}`}
                onClick={handleSaveProfile}
                disabled={savingProfile || profileName.trim().length < 2 || !!avatarError}
                type="button"
              >
                {savingProfile ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};