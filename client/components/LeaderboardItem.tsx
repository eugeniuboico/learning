import React from 'react';
import { User } from '../types';
import { getFileUrl } from '../config';

interface LeaderboardItemProps {
  user: User;
}

// Helper function to generate consistent gradient colors based on name
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

export const LeaderboardItem: React.FC<LeaderboardItemProps> = ({ user }) => {
  const rank = user.rank || 999;
  const isTop3 = rank <= 3;
  const initial = user.name.charAt(0).toUpperCase();

  // Render logic for Rank 1
  if (rank === 1) {
    return (
      <div className="relative bg-white dark:bg-gray-800 rounded-full border-2 border-primary p-2 pl-14 pr-6 flex items-center justify-between shadow-sm hover:shadow-md transition-all cursor-pointer group mb-3">
        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full border-4 border-yellow-400 shadow-md z-10 overflow-hidden">
          {getFileUrl(user.avatar_url) ? (
            <img src={getFileUrl(user.avatar_url)!} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${getGradientForName(user.name)} flex items-center justify-center font-bold text-white text-base`}>
              {initial}
            </div>
          )}
        </div>
        <div className="absolute left-0 top-0 bg-yellow-400 text-white w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-gray-800 font-bold shadow-md z-20 text-[0.6rem]">
          <span className="material-icons text-xs">emoji_events</span>
        </div>
        <span className="font-bold italic text-gray-900 dark:text-gray-100 text-sm mr-2">{user.name}</span>
        <div className="flex items-center font-bold text-gray-900 dark:text-gray-100 text-sm whitespace-nowrap">
          {user.stars} <span className="material-icons ml-1 text-base text-yellow-400">stars</span>
        </div>
      </div>
    );
  }

  // Render logic for Rank 2
  if (rank === 2) {
    return (
      <div className="relative bg-white dark:bg-gray-800 rounded-full border-2 border-yellow-400 p-2 pl-14 pr-6 flex items-center justify-between shadow-sm hover:shadow-md transition-all cursor-pointer group mb-3">
        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full border-4 border-gray-300 shadow-md z-10 overflow-hidden">
          {getFileUrl(user.avatar_url) ? (
            <img src={getFileUrl(user.avatar_url)!} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${getGradientForName(user.name)} flex items-center justify-center font-bold text-white text-base`}>
              {initial}
            </div>
          )}
        </div>
        <div className="absolute left-0 top-0 bg-gray-300 text-gray-600 w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-gray-800 font-bold shadow-md z-20 text-[0.55rem] leading-none">
          2<span className="text-[0.4rem] align-top">nd</span>
        </div>
        <span className="font-bold italic text-gray-900 dark:text-gray-100 text-sm mr-2">{user.name}</span>
        <div className="flex items-center font-bold text-gray-900 dark:text-gray-100 text-sm whitespace-nowrap">
          {user.stars} <span className="material-icons ml-1 text-base text-yellow-400">stars</span>
        </div>
      </div>
    );
  }

  // Render logic for Rank 3
  if (rank === 3) {
    return (
      <div className="relative bg-white dark:bg-gray-800 rounded-full border-2 border-orange-400 p-2 pl-14 pr-6 flex items-center justify-between shadow-sm hover:shadow-md transition-all cursor-pointer group mb-3">
        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full border-4 border-orange-400 shadow-md z-10 overflow-hidden">
          {getFileUrl(user.avatar_url) ? (
            <img src={getFileUrl(user.avatar_url)!} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${getGradientForName(user.name)} flex items-center justify-center font-bold text-white text-base`}>
              {initial}
            </div>
          )}
        </div>
        <div className="absolute left-0 top-0 bg-orange-400 text-white w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-gray-800 font-bold shadow-md z-20 text-[0.55rem] leading-none">
          3<span className="text-[0.4rem] align-top">rd</span>
        </div>
        <span className="font-bold italic text-gray-900 dark:text-gray-100 text-sm mr-2">{user.name}</span>
        <div className="flex items-center font-bold text-gray-900 dark:text-gray-100 text-sm whitespace-nowrap">
          {user.stars} <span className="material-icons ml-1 text-base text-yellow-400">stars</span>
        </div>
      </div>
    );
  }

  // Render logic for Rank 4+
  return (
    <div className="relative bg-white dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-600 p-2 pl-14 pr-6 flex items-center justify-between shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors mb-3">
      <div className="absolute left-1 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full shadow-md z-10 overflow-hidden">
        {getFileUrl(user.avatar_url) ? (
          <img src={getFileUrl(user.avatar_url)!} alt={user.name} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${getGradientForName(user.name)} flex items-center justify-center font-bold text-white text-base`}>
            {initial}
          </div>
        )}
      </div>
      <span className="font-bold italic text-gray-600 dark:text-gray-300 text-sm">{user.name}</span>
      <div className="flex items-center font-bold text-gray-800 dark:text-gray-200 text-sm whitespace-nowrap">
        {user.stars} <span className="material-icons ml-1 text-base text-yellow-400">stars</span>
      </div>
    </div>
  );
};