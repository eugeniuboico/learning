import { useState, useEffect } from 'react';
import { Chat, Message } from '../types';
import { useSocket } from '../contexts/SocketContext';
import ChatWindow from './ChatWindow';
import { apiUrl } from '../config';
import CreateChatModal from './CreateChatModal';

interface ChatWidgetProps {
  currentUserId: number;
  userRole: 'admin' | 'student';
}

export default function ChatWidget({ currentUserId, userRole }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastSeenMessages, setLastSeenMessages] = useState<{ [chatId: number]: string }>({});
  const { socket } = useSocket();

  // Fetch chats from API
  const fetchChats = async () => {
    try {
      setLoading(true);
      const response = await fetch(apiUrl('/chats'), {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setChats(data);
      }
    } catch (error) {
      console.error('Failed to fetch chats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchChats();
    }
    
    // Load last seen messages from localStorage
    const saved = localStorage.getItem('chatLastSeen');
    if (saved) {
      try {
        setLastSeenMessages(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved last seen messages');
      }
    }
  }, [isOpen]);

  // Save last seen messages to localStorage
  useEffect(() => {
    localStorage.setItem('chatLastSeen', JSON.stringify(lastSeenMessages));
  }, [lastSeenMessages]);

  // Listen for new messages via Socket.IO to update chat list
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: { chatId: number; message: Message }) => {
      // Update chat list with new message and reorder
      setChats(prev => {
        const updatedChats = prev.map(chat => {
          if (chat.id === data.chatId) {
            return {
              ...chat,
              last_message: data.message.content,
              last_message_at: data.message.created_at
            };
          }
          return chat;
        });
        
        // Sort by last message time
        return updatedChats.sort((a, b) => {
          const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
          const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
          return timeB - timeA;
        });
      });
      
      // Mark as read if chat is currently open
      if (activeChat === data.chatId) {
        setLastSeenMessages(prev => ({
          ...prev,
          [data.chatId]: data.message.created_at
        }));
      }
    };

    socket.on('new_message', handleNewMessage);

    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, activeChat]);

  const handleChatClick = (chatId: number) => {
    setActiveChat(chatId);
    
    // Mark chat as read when opened
    const chat = chats.find(c => c.id === chatId);
    if (chat && chat.last_message_at) {
      setLastSeenMessages(prev => ({
        ...prev,
        [chatId]: chat.last_message_at!
      }));
    }
  };

  const handleBackToList = () => {
    setActiveChat(null);
  };

  const handleChatCreated = (newChat: Chat) => {
    setChats([newChat, ...chats]);
    setShowCreateModal(false);
    // Automatically open the new chat
    setActiveChat(newChat.id);
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  // Calculate unread chats count
  const unreadChatsCount = chats.filter(chat => {
    if (!chat.last_message_at) return false;
    const lastSeen = lastSeenMessages[chat.id];
    if (!lastSeen) return true; // Never seen this chat
    return new Date(chat.last_message_at) > new Date(lastSeen);
  }).length;

  return (
    <>
      {/* Chat Button - Only show when closed */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-40">
          <button
            onClick={() => setIsOpen(true)}
            className="bg-primary hover:bg-primary-dark text-white rounded-full p-4 shadow-lg transition-colors flex items-center justify-center w-14 h-14 relative"
          >
            <span className="material-icons text-2xl">chat_bubble_outline</span>
            {unreadChatsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {unreadChatsCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-40 flex flex-col max-h-[500px]">
          {activeChat ? (
            /* Active Chat View */
            <>
              {(() => {
                const chat = chats.find(c => c.id === activeChat);
                if (!chat) return null;
                return (
                  <ChatWindow
                    chat={chat}
                    currentUserId={currentUserId}
                    onBack={handleBackToList}
                    onClose={() => setIsOpen(false)}
                  />
                );
              })()}
            </>
          ) : (
            /* Chat List View */
            <>
              {/* Header */}
              <div className="bg-gradient-to-r from-primary to-primary-dark text-white p-4 flex items-center justify-between flex-shrink-0">
                <h3 className="font-bold text-lg">Chats</h3>
                <div className="flex items-center space-x-1">
                  {userRole === 'admin' && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="hover:bg-white/20 rounded-full p-1 transition-colors"
                    >
                      <span className="material-icons text-xl">add</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="hover:bg-white/20 rounded-full p-1 transition-colors"
                  >
                    <span className="material-icons text-xl">close</span>
                  </button>
                </div>
              </div>

              {/* Chat List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
            {loading ? (
              <div className="p-8 text-center text-gray-500">
                <span className="material-icons animate-spin text-3xl">refresh</span>
              </div>
            ) : chats.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <span className="material-icons text-4xl mb-2">chat_bubble_outline</span>
                <p className="text-sm">No chats yet</p>
                <p className="text-xs mt-1">Create a new chat to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {chats.map((chat) => {
                  const isUnread = chat.last_message_at && (!lastSeenMessages[chat.id] || new Date(chat.last_message_at) > new Date(lastSeenMessages[chat.id]));
                  
                  return (
                    <div
                      key={chat.id}
                      onClick={() => handleChatClick(chat.id)}
                      className={`
                        p-3 rounded-xl cursor-pointer transition-all relative
                        border-2 shadow-sm
                        ${isUnread 
                          ? 'bg-primary/5 border-primary hover:bg-primary/10 hover:shadow-md' 
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-primary hover:shadow-md'
                        }
                      `}
                    >
                      {isUnread && (
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                      )}
                      <div className="flex items-start justify-between ml-3">
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-gray-900 dark:text-white truncate ${isUnread ? 'font-bold' : 'font-semibold'}`}>
                            {chat.name}
                          </h4>
                          {chat.last_message && (
                            <p className={`text-sm truncate mt-1 ${isUnread ? 'text-gray-700 dark:text-gray-300 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                              {chat.last_message}
                            </p>
                          )}
                        </div>
                        {chat.last_message_at && (
                          <span className={`text-xs ml-2 flex-shrink-0 ${isUnread ? 'text-primary font-semibold' : 'text-gray-400'}`}>
                            {formatTime(chat.last_message_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Create Chat Modal */}
      {showCreateModal && (
        <CreateChatModal
          onClose={() => setShowCreateModal(false)}
          onChatCreated={handleChatCreated}
        />
      )}
    </>
  );
}

