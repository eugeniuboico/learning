import { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';

interface OnlineUser {
  id: number;
  name: string;
  avatar_url: string | null;
}

export const useOnlineUsers = () => {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) {
      setOnlineUsers([]);
      return;
    }

    // Listen for online users updates
    const handleOnlineUsersUpdate = (users: OnlineUser[]) => {
      console.log('[Socket.IO] Online users updated:', users);
      setOnlineUsers(users);
    };

    socket.on('online_users_update', handleOnlineUsersUpdate);

    // Cleanup
    return () => {
      socket.off('online_users_update', handleOnlineUsersUpdate);
    };
  }, [socket]);

  return onlineUsers;
};

