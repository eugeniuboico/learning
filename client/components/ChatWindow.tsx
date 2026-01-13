import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Chat, Message, ChatMember } from '../types';
import { useSocket } from '../contexts/SocketContext';
import { ConfirmDialog } from './ConfirmDialog';
import { apiUrl, API_URL, getFileUrl } from '../config';

interface ChatWindowProps {
  chat: Chat;
  currentUserId: number;
  onBack: () => void;
  onClose: () => void;
}

export default function ChatWindow({ chat, currentUserId, onBack, onClose }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [allUsers, setAllUsers] = useState<ChatMember[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(chat.name);
  const [loading, setLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ userId: number; userName: string }[]>([]);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editedMessageContent, setEditedMessageContent] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; messageId: number; hasText: boolean } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; messageId?: number; isChat?: boolean }>({ isOpen: false });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { socket } = useSocket();

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle ESC key to close image preview and context menu
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewImage) setPreviewImage(null);
        if (contextMenu) setContextMenu(null);
      }
    };
    
    const handleClick = () => {
      if (contextMenu) setContextMenu(null);
    };
    
    window.addEventListener('keydown', handleEsc);
    window.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('keydown', handleEsc);
      window.removeEventListener('click', handleClick);
    };
  }, [previewImage, contextMenu]);

  // Fetch messages
  const fetchMessages = async () => {
    try {
      const response = await fetch(apiUrl(`/chats/${chat.id}/messages`), {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  // Fetch members
  const fetchMembers = async () => {
    try {
      const response = await fetch(apiUrl(`/chats/${chat.id}/members`), {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  };

  // Fetch all users for adding members
  const fetchAllUsers = async () => {
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

  useEffect(() => {
    fetchMessages();
    fetchMembers();
    
    // Cleanup typing timeout on unmount
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [chat.id]);

  // Listen for Socket.IO events
  useEffect(() => {
    if (!socket) return;

    // Listen for new messages
    const handleNewMessage = (data: { chatId: number | string; message: Message }) => {
      console.log('[ChatWindow] Received new_message:', data, 'current chat.id:', chat.id);
      // Convert both to numbers for comparison (server might send string or number)
      if (Number(data.chatId) === Number(chat.id)) {
        // Check if message already exists (avoid duplicates)
        setMessages(prev => {
          const exists = prev.some(m => m.id === data.message.id);
          if (exists) return prev;
          return [...prev, data.message];
        });
        setTimeout(scrollToBottom, 100);
      } else {
        console.log('[ChatWindow] Message ignored - wrong chat. Expected:', chat.id, 'Got:', data.chatId);
      }
    };

    // Listen for member changes
    const handleMemberAdded = (data: { chatId: number | string; user: ChatMember }) => {
      if (Number(data.chatId) === Number(chat.id)) {
        fetchMembers();
      }
    };

    const handleMemberRemoved = (data: { chatId: number | string; userId: number }) => {
      if (Number(data.chatId) === Number(chat.id)) {
        fetchMembers();
      }
    };

    // Listen for typing indicators
    const handleUserTyping = (data: { chatId: number | string; userId: number; userName: string }) => {
      if (Number(data.chatId) === Number(chat.id) && data.userId !== currentUserId) {
        setTypingUsers(prev => {
          const exists = prev.some(u => u.userId === data.userId);
          if (exists) return prev;
          return [...prev, { userId: data.userId, userName: data.userName }];
        });
      }
    };

    const handleUserStoppedTyping = (data: { chatId: number | string; userId: number }) => {
      if (Number(data.chatId) === Number(chat.id)) {
        setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
      }
    };

    // Listen for message edits
    const handleMessageEdited = (data: { chatId: number | string; message: Message }) => {
      if (Number(data.chatId) === Number(chat.id)) {
        setMessages(prev => prev.map(msg => msg.id === data.message.id ? data.message : msg));
      }
    };

    // Listen for message deletions
    const handleMessageDeleted = (data: { chatId: number | string; messageId: number }) => {
      if (Number(data.chatId) === Number(chat.id)) {
        setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('member_added', handleMemberAdded);
    socket.on('member_removed', handleMemberRemoved);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stopped_typing', handleUserStoppedTyping);
    socket.on('message_edited', handleMessageEdited);
    socket.on('message_deleted', handleMessageDeleted);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('member_added', handleMemberAdded);
      socket.off('member_removed', handleMemberRemoved);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stopped_typing', handleUserStoppedTyping);
      socket.off('message_edited', handleMessageEdited);
      socket.off('message_deleted', handleMessageDeleted);
    };
  }, [socket, chat.id, currentUserId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter((file: File) => file.type.startsWith('image/'));
    setSelectedImages(prev => [...prev, ...imageFiles]);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter((item: DataTransferItem) => item.type.startsWith('image/'));
    
    imageItems.forEach((item: DataTransferItem) => {
      const file = item.getAsFile();
      if (file) {
        setSelectedImages(prev => [...prev, file]);
      }
    });
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditMessage = async (messageId: number) => {
    if (!editedMessageContent.trim()) return;

    try {
      const response = await fetch(apiUrl(`/chats/${chat.id}/messages/${messageId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: editedMessageContent })
      });

      if (response.ok) {
        const updatedMessage = await response.json();
        setMessages(prev => prev.map(msg => msg.id === messageId ? updatedMessage : msg));
        setEditingMessageId(null);
        setEditedMessageContent('');
      }
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    try {
      const response = await fetch(apiUrl(`/chats/${chat.id}/messages/${messageId}`), {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const confirmDeleteMessage = (messageId: number) => {
    setDeleteConfirm({ isOpen: true, messageId });
  };

  const startEditingMessage = (message: Message) => {
    setEditingMessageId(message.id);
    setEditedMessageContent(message.content);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditedMessageContent('');
  };

  const handleContextMenu = (e: React.MouseEvent, message: Message) => {
    e.preventDefault();
    if (message.user_id === currentUserId) {
      // Calculate position to keep menu within viewport
      const menuWidth = 120;
      const menuHeight = message.content ? 80 : 40;
      
      let x = e.clientX;
      let y = e.clientY;
      
      // Adjust if menu would go off right edge
      if (x + menuWidth > window.innerWidth) {
        x = window.innerWidth - menuWidth - 10;
      }
      
      // Adjust if menu would go off bottom edge
      if (y + menuHeight > window.innerHeight) {
        y = window.innerHeight - menuHeight - 10;
      }
      
      setContextMenu({
        x,
        y,
        messageId: message.id,
        hasText: !!message.content
      });
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && selectedImages.length === 0) return;

    try {
      const formData = new FormData();
      formData.append('content', newMessage);
      
      selectedImages.forEach(image => {
        formData.append('images', image);
      });

      const response = await fetch(apiUrl(`/chats/${chat.id}/messages`), {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (response.ok) {
        const message = await response.json();
        // Add message immediately to local state
        setMessages(prev => [...prev, message]);
        setNewMessage('');
        setSelectedImages([]);
        
        // Emit stopped typing when message is sent
        if (socket) {
          socket.emit('user_stopped_typing', {
            chatId: chat.id,
            userId: currentUserId
          });
        }
        
        // Clear typing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        
        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    if (!socket) return;

    // Emit typing event
    if (value.trim()) {
      socket.emit('user_typing', {
        chatId: chat.id,
        userId: currentUserId,
        userName: members.find(m => m.id === currentUserId)?.name || 'User'
      });

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set timeout to emit stopped typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('user_stopped_typing', {
          chatId: chat.id,
          userId: currentUserId
        });
      }, 2000);
    } else {
      // If input is empty, immediately emit stopped typing
      socket.emit('user_stopped_typing', {
        chatId: chat.id,
        userId: currentUserId
      });
    }
  };

  const handleAddMember = async (userId: number) => {
    try {
      const response = await fetch(apiUrl(`/chats/${chat.id}/members`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        setShowAddMember(false);
        fetchMembers();
      }
    } catch (error) {
      console.error('Failed to add member:', error);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    try {
      const response = await fetch(apiUrl(`/chats/${chat.id}/members/${userId}`), {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        fetchMembers();
      }
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  const handleSaveEdit = async () => {
    if (!editedName.trim()) return;

    try {
      setLoading(true);
      const response = await fetch(apiUrl(`/chats/${chat.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: editedName })
      });

      if (response.ok) {
        setIsEditing(false);
        chat.name = editedName;
      }
    } catch (error) {
      console.error('Failed to update chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChat = async () => {
    try {
      const response = await fetch(apiUrl(`/chats/${chat.id}`), {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        onBack();
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  const confirmDeleteChat = () => {
    setDeleteConfirm({ isOpen: true, isChat: true });
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateSeparator = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Reset time to compare only dates
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    if (dateOnly.getTime() === todayOnly.getTime()) {
      return 'Today';
    } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    }
  };

  const shouldShowDateSeparator = (currentMessage: Message, previousMessage: Message | null) => {
    if (!previousMessage) return true;
    
    const currentDate = new Date(currentMessage.created_at);
    const previousDate = new Date(previousMessage.created_at);
    
    return currentDate.toDateString() !== previousDate.toDateString();
  };

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  const availableUsers = allUsers.filter(
    user => !members.some(member => member.id === user.id)
  );

  return (
    <>
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary-dark text-white p-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <button
            onClick={onBack}
            className="hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <span className="material-icons text-sm">arrow_back</span>
          </button>
          {isEditing ? (
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
              className="bg-white/20 text-white px-2 py-1 rounded flex-1 outline-none"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <h4 className="font-semibold truncate">{chat.name}</h4>
          )}
          <span className="text-xs opacity-75">({members.length})</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(!isEditing);
            }}
            className="hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <span className="material-icons text-sm">edit</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMembers(!showMembers);
              if (!showMembers) fetchAllUsers();
            }}
            className="hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <span className="material-icons text-sm">group</span>
          </button>
          <button
            onClick={onClose}
            className="hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <span className="material-icons text-sm">close</span>
          </button>
        </div>
      </div>

      {/* Members Panel */}
          {showMembers && (
            <div className="bg-gray-50 dark:bg-gray-900 p-3 border-b border-gray-200 dark:border-gray-700 max-h-40 overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Members</h5>
                <button
                  onClick={() => setShowAddMember(!showAddMember)}
                  className="text-primary hover:text-primary-dark"
                >
                  <span className="material-icons text-sm">person_add</span>
                </button>
              </div>

              {showAddMember && (
                <div className="mb-2 space-y-1">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Add member:</p>
                  {availableUsers.length === 0 ? (
                    <p className="text-xs text-gray-500">No users to add</p>
                  ) : (
                    availableUsers.map(user => (
                      <div
                        key={user.id}
                        onClick={() => handleAddMember(user.id)}
                        className="flex items-center space-x-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded cursor-pointer"
                      >
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/30 to-primary/50 flex items-center justify-center text-xs font-bold text-primary-dark">
                          {getFileUrl(user.avatar_url) ? (
                            <img src={getFileUrl(user.avatar_url)!} alt={user.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            getInitial(user.name)
                          )}
                        </div>
                        <span className="text-xs text-gray-700 dark:text-gray-300">{user.name}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              <div className="space-y-1">
                {members.map(member => (
                  <div key={member.id} className="flex items-center justify-between p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/30 to-primary/50 flex items-center justify-center text-xs font-bold text-primary-dark">
                        {getFileUrl(member.avatar_url) ? (
                          <img src={getFileUrl(member.avatar_url)!} alt={member.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          getInitial(member.name)
                        )}
                      </div>
                      <span className="text-xs text-gray-700 dark:text-gray-300">{member.name}</span>
                      {member.id === chat.created_by && (
                        <span className="text-[0.6rem] bg-primary/20 text-primary-dark px-1 rounded">creator</span>
                      )}
                    </div>
                    {(currentUserId === chat.created_by || currentUserId === member.id) && member.id !== chat.created_by && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <span className="material-icons text-sm">close</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-gray-50 dark:bg-gray-900">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
                <span className="material-icons text-4xl mb-2">chat</span>
                <p className="text-sm">No messages yet</p>
                <p className="text-xs">Start the conversation!</p>
              </div>
            ) : (
              messages.map((message, index) => {
                const isOwn = message.user_id === currentUserId;
                const previousMessage = index > 0 ? messages[index - 1] : null;
                const showDateSeparator = shouldShowDateSeparator(message, previousMessage);
                
                return (
                  <div key={message.id}>
                    {showDateSeparator && (
                      <div className="flex justify-center my-3">
                        <div className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[0.65rem] font-medium px-2.5 py-0.5 rounded-full">
                          {formatDateSeparator(message.created_at)}
                        </div>
                      </div>
                    )}
                    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1.5 group`}>
                    <div className={`flex items-end max-w-[70%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                      {!isOwn && (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/30 to-primary/50 flex items-center justify-center text-[0.6rem] font-bold text-primary-dark flex-shrink-0 mb-0.5 mr-1">
                          {message.user_avatar ? (
                            <img src={message.user_avatar} alt={message.user_name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            getInitial(message.user_name)
                          )}
                        </div>
                      )}
                      <div className="relative">
                        <div className={`flex items-end ${isOwn ? 'flex-row-reverse' : ''}`}>
                          <div 
                            className={`px-2.5 py-1.5 rounded-2xl shadow-sm ${isOwn ? 'bg-primary text-white rounded-br-sm' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-sm'}`}
                            onContextMenu={(e) => handleContextMenu(e, message)}
                          >
                            {!isOwn && (
                              <p className="text-[0.6rem] font-semibold mb-0.5" style={{ color: '#10b981' }}>{message.user_name}</p>
                            )}
                            
                            {/* Images */}
                            {message.images && (() => {
                              try {
                                const imageList = JSON.parse(message.images);
                                if (Array.isArray(imageList) && imageList.length > 0) {
                                  return (
                                    <div className="flex flex-wrap gap-1 mb-1">
                                      {imageList.map((imagePath, idx) => (
                                        <img 
                                          key={idx}
                                          src={`${API_URL}${imagePath}`}
                                          alt={`Image ${idx + 1}`}
                                          className="max-w-[200px] max-h-[200px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                          onClick={() => setPreviewImage(`${API_URL}${imagePath}`)}
                                        />
                                      ))}
                                    </div>
                                  );
                                }
                              } catch (e) {
                                console.error('Error parsing images:', e);
                              }
                              return null;
                            })()}
                            
                            {/* Message Content - Editable or Display */}
                            {message.content && (
                              editingMessageId === message.id ? (
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="text"
                                    value={editedMessageContent}
                                    onChange={(e) => setEditedMessageContent(e.target.value)}
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') handleEditMessage(message.id);
                                      if (e.key === 'Escape') cancelEditing();
                                    }}
                                    className="flex-1 px-2 py-1 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded outline-none"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleEditMessage(message.id)}
                                    className="text-green-500 hover:text-green-600"
                                  >
                                    <span className="material-icons text-sm">check</span>
                                  </button>
                                  <button
                                    onClick={cancelEditing}
                                    className="text-red-500 hover:text-red-600"
                                  >
                                    <span className="material-icons text-sm">close</span>
                                  </button>
                                </div>
                              ) : (
                                <p className="text-xs break-words leading-snug">{message.content}</p>
                              )
                            )}
                          </div>
                          <p className={`text-[0.55rem] text-gray-400 dark:text-gray-500 pb-0.5 whitespace-nowrap transition-all duration-200 ${
                            isOwn 
                              ? 'max-w-0 opacity-0 overflow-hidden group-hover:max-w-[4rem] group-hover:opacity-100 group-hover:mr-2' 
                              : 'opacity-100 ml-1'
                          }`}>
                            {formatMessageTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Typing Indicator */}
          {typingUsers.length > 0 && (
            <div className="px-4 py-2 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                {/* Avatars of typing users */}
                <div className="flex -space-x-2">
                  {typingUsers.slice(0, 3).map((user) => {
                    const member = members.find(m => m.id === user.userId);
                    return (
                      <div
                        key={user.userId}
                        className="relative group"
                        title={user.userName}
                      >
                        <div className="w-6 h-6 rounded-full overflow-hidden border-2 border-white dark:border-gray-800 shadow-sm bg-gradient-to-br from-primary/30 to-primary/50 flex items-center justify-center text-[0.6rem] font-bold text-primary-dark">
                          {getFileUrl(member?.avatar_url) ? (
                            <img src={getFileUrl(member.avatar_url)!} alt={user.userName} className="w-full h-full object-cover" />
                          ) : (
                            getInitial(user.userName)
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {typingUsers.length > 3 && (
                    <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center">
                      <span className="text-[0.6rem] font-bold text-gray-600 dark:text-gray-300">+{typingUsers.length - 3}</span>
                    </div>
                  )}
                </div>
                
                {/* Animated dots */}
                <div className="flex space-x-1">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            {/* Image Preview */}
            {selectedImages.length > 0 && (
              <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                <div className="flex flex-wrap gap-2">
                  {selectedImages.map((image, index) => (
                    <div key={index} className="relative group">
                      <img 
                        src={URL.createObjectURL(image)} 
                        alt={`Preview ${index + 1}`}
                        className="w-20 h-20 object-cover rounded-lg border-2 border-gray-300 dark:border-gray-600"
                      />
                      <button
                        onClick={() => handleRemoveImage(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <span className="material-icons text-xs">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Input Area */}
            <div className="p-3">
              <div className="flex items-center space-x-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-gray-500 hover:text-primary transition-colors"
                  title="Attach image"
                >
                  <span className="material-icons text-xl">image</span>
                </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  onPaste={handlePaste}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() && selectedImages.length === 0}
                  className="bg-primary hover:bg-primary-dark text-white rounded-full p-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <span className="material-icons text-lg">send</span>
                </button>
              </div>
            </div>
          </div>

          {/* Context Menu */}
          {contextMenu && ReactDOM.createPortal(
            <div
              className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-0.5"
              style={{
                left: `${contextMenu.x}px`,
                top: `${contextMenu.y}px`,
                zIndex: 99999,
                minWidth: '120px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {contextMenu.hasText && (
                <button
                  onClick={() => {
                    const message = messages.find(m => m.id === contextMenu.messageId);
                    if (message) startEditingMessage(message);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
                >
                  <span className="material-icons text-sm text-blue-500">edit</span>
                  <span>Edit</span>
                </button>
              )}
              <button
                onClick={() => {
                  confirmDeleteMessage(contextMenu.messageId);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
              >
                <span className="material-icons text-sm text-red-500">delete</span>
                <span>Delete</span>
              </button>
            </div>,
            document.body
          )}

          {/* Image Preview Modal - Rendered in body via Portal */}
          {previewImage && ReactDOM.createPortal(
            <div 
              className="fixed inset-0 bg-black/90 flex items-center justify-center p-4"
              style={{ zIndex: 99999 }}
              onClick={() => setPreviewImage(null)}
            >
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
              >
                <span className="material-icons text-4xl">close</span>
              </button>
              <img 
                src={previewImage}
                alt="Preview"
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>,
            document.body
          )}

          {/* Confirm Delete Dialog */}
          <ConfirmDialog
            isOpen={deleteConfirm.isOpen}
            title={deleteConfirm.isChat ? "Delete Chat" : "Delete Message"}
            message={deleteConfirm.isChat 
              ? "Are you sure you want to delete this chat? This action cannot be undone." 
              : "Are you sure you want to delete this message? This action cannot be undone."}
            confirmText="Delete"
            cancelText="Cancel"
            variant="danger"
            onConfirm={() => {
              if (deleteConfirm.isChat) {
                handleDeleteChat();
              } else if (deleteConfirm.messageId) {
                handleDeleteMessage(deleteConfirm.messageId);
              }
              setDeleteConfirm({ isOpen: false });
            }}
            onCancel={() => setDeleteConfirm({ isOpen: false })}
          />
    </>
  );
}

