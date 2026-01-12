import { useState, useEffect } from 'react';
import { Chat, User } from '../types';
import { apiUrl, getFileUrl } from '../config';

interface CreateChatModalProps {
  onClose: () => void;
  onChatCreated: (chat: Chat) => void;
}

export default function CreateChatModal({ onClose, onChatCreated }: CreateChatModalProps) {
  const [chatName, setChatName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch(apiUrl('/users'), {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setAllUsers(data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleToggleUser = (userId: number) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    if (!chatName.trim()) {
      setError('Please enter a chat name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/chats'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: chatName,
          memberIds: selectedUsers
        })
      });

      if (response.ok) {
        const newChat = await response.json();
        onChatCreated(newChat);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create chat');
      }
    } catch (error) {
      console.error('Failed to create chat:', error);
      setError('Failed to create chat');
    } finally {
      setLoading(false);
    }
  };

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  const getGradientForName = (name: string) => {
    const colors = [
      'from-orange-300 to-orange-400',
      'from-blue-300 to-blue-400',
      'from-green-300 to-green-400',
      'from-purple-300 to-purple-400',
      'from-pink-300 to-pink-400',
      'from-yellow-300 to-yellow-400',
      'from-red-300 to-red-400',
      'from-indigo-300 to-indigo-400',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary-dark text-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Create New Chat</h3>
            <button
              onClick={onClose}
              className="hover:bg-white/20 rounded-full p-1 transition-colors"
            >
              <span className="material-icons">close</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* Chat Name Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Chat Name *
            </label>
            <input
              type="text"
              value={chatName}
              onChange={(e) => setChatName(e.target.value)}
              placeholder="Enter chat name..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-primary"
              autoFocus
            />
          </div>

          {/* User Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Add Members (Optional)
            </label>
            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              {allUsers.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No users available
                </p>
              ) : (
                allUsers.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => handleToggleUser(user.id)}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedUsers.includes(user.id)
                        ? 'bg-primary/10 border-2 border-primary'
                        : 'bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getGradientForName(user.name)} flex items-center justify-center font-bold text-white text-sm shadow-md overflow-hidden`}>
                        {getFileUrl(user.avatar_url) ? (
                          <img src={getFileUrl(user.avatar_url)!} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          getInitial(user.name)
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{user.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                      </div>
                    </div>
                    {selectedUsers.includes(user.id) && (
                      <span className="material-icons text-primary">check_circle</span>
                    )}
                  </div>
                ))
              )}
            </div>
            {selectedUsers.length > 0 && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                {selectedUsers.length} member{selectedUsers.length > 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 flex items-center justify-end space-x-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !chatName.trim()}
            className="px-6 py-2 bg-gradient-to-r from-primary to-primary-dark text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {loading ? (
              <span className="flex items-center space-x-2">
                <span className="material-icons animate-spin text-sm">refresh</span>
                <span>Creating...</span>
              </span>
            ) : (
              'Create Chat'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

