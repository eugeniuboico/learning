import React, { useState, useEffect } from 'react';
import { LeaderboardItem } from './LeaderboardItem';
import { apiUrl } from '../config';
import { useSocket } from '../contexts/SocketContext';
import { User } from '../types';

// Mock Data
const MOCK_USERS: User[] = [
    { id: 1, name: 'Nume Prenume', stars: 1460, rank: 1, email: 'mock@test.com', role: 'student' },
    { id: 2, name: 'Nume Prenume', stars: 1378, rank: 2, email: 'mock@test.com', role: 'student' },
    { id: 3, name: 'Nume Prenume', stars: 1057, rank: 3, email: 'mock@test.com', role: 'student' },
    { id: 4, name: 'Nume Prenume', stars: 950, rank: 4, email: 'mock@test.com', role: 'student' },
    { id: 5, name: 'Nume Prenume', stars: 946, rank: 5, email: 'mock@test.com', role: 'student' },
    { id: 6, name: 'Nume Prenume', stars: 890, rank: 6, email: 'mock@test.com', role: 'student' },
];

export const LeaderboardPanel: React.FC = () => {
    const [users, setUsers] = useState<User[]>(MOCK_USERS);
    const { socket } = useSocket();

    // Fetch users for leaderboard
    const fetchUsers = async () => {
        try {
            const response = await fetch(apiUrl('/users'));
            if (response.ok) {
                const data = await response.json();
                // Map backend data to User interface (and calculate rank)
                const mappedUsers = data.map((u: any, index: number) => ({
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    role: u.role,
                    stars: u.stars || 0,
                    rank: index + 1,
                    avatar_url: u.avatar_url
                }));
                setUsers(mappedUsers);
            }
        } catch (error) {
            console.error('Failed to fetch leaderboard', error);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // Socket.IO listener for live leaderboard updates
    useEffect(() => {
        if (!socket) return;

        socket.on('leaderboard:update', () => {
            fetchUsers();
        });

        return () => {
            socket.off('leaderboard:update');
        };
    }, [socket]);

    return (
        <aside className="lg:col-span-3 h-full overflow-hidden">
            <div className="bg-card-light dark:bg-card-dark rounded-3xl border border-gray-200 dark:border-gray-700 p-4 h-full shadow-sm flex flex-col">
                <h3 className="sr-only">Leaderboard</h3>
                <div className="overflow-y-auto flex-grow custom-scrollbar pr-1">
                    {users.map((user) => (
                        <LeaderboardItem key={user.id} user={user} />
                    ))}
                </div>
            </div>
        </aside>
    );
};
