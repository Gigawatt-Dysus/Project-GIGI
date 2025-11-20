import React, { useState } from 'react';
import type { View, Theme, User, UserStatus } from '../types';
import { ChatIcon, TimelineIcon, GalleryIcon, ProfileIcon, SunIcon, MoonIcon, TagsIcon, JournalIcon, ConsoleRoomIcon, CommsCenterIcon, BackupIcon, RestoreIcon } from './icons.tsx';
import { GIGI_AVATAR_URL } from '../services/mockData';

interface HeaderProps {
  user: User;
  onNavigate: (view: View) => void;
  currentView: View;
  theme: Theme;
  toggleTheme: () => void;
  onLogout: () => void;
  notifications: Record<string, number>;
  userStatus: UserStatus;
  onStatusChange: (status: UserStatus) => void;
  onExportAllData: () => void;
  onTriggerRestore: () => void;
}

const NavItem: React.FC<{
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  notificationCount?: number;
}> = ({ label, icon, isActive, onClick, notificationCount = 0 }) => {
  const activeClasses = 'bg-gigi-blue text-white shadow-inner';
  const inactiveClasses = 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100';
  
  return (
    <li>
      <button
        onClick={onClick}
        className={`relative flex flex-col items-center w-full px-2 py-2 text-xs font-medium rounded-md transition-colors duration-150 ${isActive ? activeClasses : inactiveClasses}`}
      >
        {icon}
        <span className="mt-1">{label}</span>
        {notificationCount > 0 && (
            <span className="absolute top-0 right-0 inline-block py-0.5 px-1.5 text-xs font-semibold text-white bg-red-500 rounded-full transform translate-x-1/3 -translate-y-1/3">
                {notificationCount > 9 ? '9+' : notificationCount}
            </span>
        )}
      </button>
    </li>
  );
};

const Header: React.FC<HeaderProps> = ({ user, onNavigate, currentView, theme, toggleTheme, onLogout, notifications, userStatus, onStatusChange, onExportAllData, onTriggerRestore }) => {
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);

  const primaryCompanion = (user.aiCompanions && user.aiCompanions.length > 0)
    ? user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0]
    : { id: 'gigi-fallback', name: 'Gigi', avatarUrl: GIGI_AVATAR_URL, bio: 'Default AI archivist.', persona: 'buddy', isPrimary: true };

  const secondaryCompanion = (user.aiCompanions && user.aiCompanions.length > 1)
    ? user.aiCompanions.find(c => !c.isPrimary)
    : null;
    
  const aiChatName = `${primaryCompanion.name || 'Gigi'}Chat`;

  const statusConfig: Record<UserStatus, { color: string, label: string }> = {
    online: { color: 'bg-green-500', label: 'Online' },
    away: { color: 'bg-yellow-500', label: 'Away' },
    busy: { color: 'bg-red-500', label: 'Busy' },
  };
  
  return (
    <header className="backdrop-blur-md shadow-sm sticky top-0 z-10">
      {/* Top Tier */}
      <div className="bg-blue-100/80 dark:bg-blue-950/80">
        <div className="container mx-auto px-4">
            <div className="flex justify-between items-center py-2">
                <div className="flex items-center space-x-6 min-w-0">
                    <div className="flex items-center cursor-pointer" onClick={() => onNavigate('aiCompanionEditor')}>
                        <img 
                        src={primaryCompanion.avatarUrl} 
                        alt={`${primaryCompanion.name}'s avatar`}
                        className="h-10 w-10 rounded-full object-cover border-2 border-transparent hover:border-gigi-blue transition flex-shrink-0 ai-avatar-glow"
                        />
                        <span className="ml-3 text-2xl font-bold text-gray-800 dark:text-gray-100 tracking-tight truncate">
                        {primaryCompanion.name || 'Gigi'}
                        </span>
                    </div>
                    {secondaryCompanion && (
                        <div className="hidden sm:flex items-center cursor-pointer" onClick={() => onNavigate('aiCompanionEditor')}>
                            <img 
                                src={secondaryCompanion.avatarUrl} 
                                alt={`${secondaryCompanion.name}'s avatar`}
                                className="h-10 w-10 rounded-full object-cover border-2 border-transparent hover:border-gigi-blue transition flex-shrink-0 ai-avatar-glow"
                            />
                            <span className="ml-3 text-2xl font-bold text-gray-800 dark:text-gray-100 tracking-tight truncate">
                                {secondaryCompanion.name}
                            </span>
                        </div>
                    )}
                </div>
            
            <div className="flex items-center space-x-2 flex-shrink-0">
                <button
                    onClick={onExportAllData}
                    className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                    aria-label="Backup Now"
                    title="Backup Now"
                >
                    <BackupIcon className="h-6 w-6" />
                </button>
                <button
                    onClick={onTriggerRestore}
                    className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Restore from Backup"
                    title="Restore from Backup"
                >
                    <RestoreIcon className="h-6 w-6" />
                </button>
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Toggle theme"
                >
                    {theme === 'light' ? <MoonIcon className="h-6 w-6" /> : <SunIcon className="h-6 w-6" />}
                </button>
                <button 
                    onClick={onLogout}
                    className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                >
                    Logout
                </button>
                <div className="relative">
                    <button onClick={() => setIsStatusMenuOpen(p => !p)} className="relative block">
                        <img 
                        src={user.profilePictureUrl} 
                        alt="User Profile" 
                        className="h-10 w-10 rounded-full object-cover border-2 border-transparent hover:border-gigi-blue transition cursor-pointer" 
                        />
                        <span className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ${statusConfig[userStatus].color} ring-white dark:ring-gray-800`} title={`Status: ${statusConfig[userStatus].label}`}></span>
                    </button>
                    {isStatusMenuOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg py-1 z-20 border dark:border-gray-600">
                            <div className="px-4 py-2 text-xs text-gray-400">Set your status</div>
                            {(Object.keys(statusConfig) as UserStatus[]).map(status => (
                                <button 
                                    key={status}
                                    onClick={() => { onStatusChange(status); setIsStatusMenuOpen(false); }}
                                    className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                                >
                                    <span className={`w-3 h-3 rounded-full ${statusConfig[status].color}`}></span>
                                    {statusConfig[status].label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Tier / Main Nav */}
      <div className="bg-white/80 dark:bg-gray-800/80">
        <div className="container mx-auto px-4">
            <nav className="hidden lg:block border-t border-gray-200 dark:border-gray-700/50 py-1">
                <div className="max-w-4xl mx-auto">
                    <ul className="flex items-center justify-center space-x-4 list-none p-0 m-0">
                    <NavItem label="Console" icon={<ConsoleRoomIcon className="h-5 w-5" />} isActive={currentView === 'dashboard'} onClick={() => onNavigate('dashboard')} />
                    <NavItem label="Chat" icon={<ChatIcon className="h-5 w-5" />} isActive={currentView === 'interviews'} onClick={() => onNavigate('interviews')} />
                    <NavItem label="Vortex" icon={<TimelineIcon className="h-5 w-5" />} isActive={currentView === 'timeVortex'} onClick={() => onNavigate('timeVortex')} />
                    <NavItem label="Tags" icon={<TagsIcon className="h-5 w-5" />} isActive={currentView === 'tags'} onClick={() => onNavigate('tags')} />
                    <NavItem label="Memories" icon={<JournalIcon className="h-5 w-5" />} isActive={currentView === 'gigiJournal'} onClick={() => onNavigate('gigiJournal')} notificationCount={notifications.gigiJournal} />
                    <NavItem label="Comms" icon={<CommsCenterIcon className="h-5 w-5" />} isActive={currentView === 'commsCenter'} onClick={() => onNavigate('commsCenter')} notificationCount={notifications.commsCenter} />
                    <NavItem label="Matrix" icon={<GalleryIcon className="h-5 w-5" />} isActive={currentView === 'theMatrix'} onClick={() => onNavigate('theMatrix')} />
                    <NavItem label="Profile" icon={<ProfileIcon className="h-5 w-5" />} isActive={currentView === 'profile'} onClick={() => onNavigate('profile')} />
                    </ul>
                </div>
            </nav>

            {/* Mobile/Tablet Nav */}
            <nav className="lg:hidden pt-2 pb-3 border-t border-gray-200 dark:border-gray-700/50">
            <ul className="grid grid-cols-4 sm:grid-cols-4 gap-2">
                <NavItem label="Console" icon={<ConsoleRoomIcon className="h-5 w-5" />} isActive={currentView === 'dashboard'} onClick={() => onNavigate('dashboard')} />
                <NavItem label="Chat" icon={<ChatIcon className="h-5 w-5" />} isActive={currentView === 'interviews'} onClick={() => onNavigate('interviews')} />
                <NavItem label="Vortex" icon={<TimelineIcon className="h-5 w-5" />} isActive={currentView === 'timeVortex'} onClick={() => onNavigate('timeVortex')} />
                <NavItem label="Tags" icon={<TagsIcon className="h-5 w-5" />} isActive={currentView === 'tags'} onClick={() => onNavigate('tags')} />
                <NavItem label="Memories" icon={<JournalIcon className="h-5 w-5" />} isActive={currentView === 'gigiJournal'} onClick={() => onNavigate('gigiJournal')} notificationCount={notifications.gigiJournal} />
                <NavItem label="Comms" icon={<CommsCenterIcon className="h-5 w-5" />} isActive={currentView === 'commsCenter'} onClick={() => onNavigate('commsCenter')} notificationCount={notifications.commsCenter} />
                <NavItem label="Matrix" icon={<GalleryIcon className="h-5 w-5" />} isActive={currentView === 'theMatrix'} onClick={() => onNavigate('theMatrix')} />
                <NavItem label="Profile" icon={<ProfileIcon className="h-5 w-5" />} isActive={currentView === 'profile'} onClick={() => onNavigate('profile')} />
            </ul>
            </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;