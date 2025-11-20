import React, { useState, useEffect } from 'react';
import type { View, User, LifeEvent, Media, Tag, Settings } from '../types';
import { ChatIcon, TimelineIcon, GalleryIcon, ProfileIcon, RefreshIcon, TagsIcon, JournalIcon, UploadIcon } from './icons';
import { generateMemoryPrompt, generateWelcomeBackMessage } from '../services/geminiService';
import DashboardHeader from './DashboardHeader';

interface DashboardProps {
  user: User;
  onNavigate: (view: View, data?: { initialMessage: string }) => void;
  events: LifeEvent[];
  tags: Tag[];
  media: Media[];
  settings: Settings;
}

const DashboardTile: React.FC<{
  title: string;
  description: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
}> = ({ title, description, icon, onClick }) => (
  <button
    onClick={onClick}
    className="bg-blue-100/50 dark:bg-blue-950/60 backdrop-blur-sm p-6 rounded-xl shadow-lg hover:shadow-violet-500/20 dark:shadow-black/50 hover:-translate-y-1 transition-all duration-300 text-left w-full h-full flex flex-col group border border-transparent hover:border-violet-300 dark:hover:border-violet-700"
  >
    <div className="flex-shrink-0 bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300 rounded-lg w-12 h-12 flex items-center justify-center">
      {icon}
    </div>
    <div className="mt-4 flex-grow">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <p className="mt-1 text-gray-500 dark:text-gray-400 text-sm">{description}</p>
    </div>
    <div className="mt-4">
      <span className="inline-block px-4 py-2 text-sm font-semibold text-white bg-gigi-blue rounded-lg shadow-sm group-hover:opacity-90 transition-opacity">
        Go to {title} &rarr;
      </span>
    </div>
  </button>
);

const MemoryPrompt: React.FC<{
    prompt: string;
    isLoading: boolean;
    onRefresh: () => void;
    onRespond: () => void;
    aiName: string;
}> = ({ prompt, isLoading, onRefresh, onRespond, aiName }) => (
    <div className="mb-8 p-6 bg-gradient-to-br from-violet-100 to-blue-100 dark:from-violet-900/70 dark:to-blue-900/70 rounded-xl shadow-lg border-l-4 border-violet-500">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">A Message from {aiName}</h2>
        {isLoading ? (
            <div className="mt-3 space-y-2 animate-pulse">
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded-md w-3/4"></div>
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded-md w-1/2"></div>
            </div>
        ) : (
            <p className="mt-2 text-gray-600 dark:text-gray-300 italic">"{prompt}"</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-4">
            <button 
                onClick={onRespond}
                disabled={isLoading}
                className="px-5 py-2 text-sm font-semibold text-white bg-gigi-blue rounded-lg shadow-sm hover:opacity-90 transition-opacity disabled:bg-opacity-50"
            >
                Respond to {aiName}
            </button>
            <button 
                onClick={onRefresh}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
                <RefreshIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                New Suggestion
            </button>
        </div>
    </div>
);


const Dashboard: React.FC<DashboardProps> = ({ onNavigate, user, events, tags, media, settings }) => {
  const [prompt, setPrompt] = useState('');
  const [isPromptLoading, setIsPromptLoading] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  
  const primaryCompanion = user.aiCompanions[0];
  const aiName = primaryCompanion?.name || 'Gigi';

  useEffect(() => {
    setWelcomeMessage(generateWelcomeBackMessage(user));
  }, [user]);
  
  const fetchPrompt = async () => {
    setIsPromptLoading(true);
    try {
        const newPrompt = await generateMemoryPrompt(
            events, 
            tags, 
            media,
            user
        );
        setPrompt(newPrompt);
    } catch (error) {
        console.error("Failed to fetch memory prompt:", error);
        setPrompt("What's a memory that's been on your mind lately?");
    } finally {
        setIsPromptLoading(false);
    }
  };

  useEffect(() => {
    if (settings.showMemoryPromptOnDashboard) {
        // Fetch prompt only if there is data to base it on.
        if(events.length > 0 || tags.length > 0 || media.length > 0) {
            fetchPrompt();
        } else {
            setPrompt("Welcome! Tell me about a favorite memory to get started.");
            setIsPromptLoading(false);
        }
    } else {
        setIsPromptLoading(false);
    }
  }, [user, events, tags, media, settings.showMemoryPromptOnDashboard]);


  return (
    <div className="space-y-8">
      <DashboardHeader />
      
      {settings.showMemoryPromptOnDashboard && (
        <>
            <div className="text-center min-h-[96px] flex flex-col justify-center">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {welcomeMessage}
                </h1>
                <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">This is your life story, ready to be explored. What would you like to do today?</p>
            </div>
            <MemoryPrompt 
                prompt={prompt} 
                isLoading={isPromptLoading}
                onRefresh={fetchPrompt}
                onRespond={() => onNavigate('interviews', { initialMessage: prompt })}
                aiName={aiName}
            />
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DashboardTile
          title={`${aiName}Chat`}
          description={<>Chat with {aiName} to add new memories and stories to your archive.</>}
          icon={<ChatIcon className="w-6 h-6" />}
          onClick={() => onNavigate('interviews')}
        />
        <DashboardTile
          title="Time Vortex"
          description="View and edit your life's events and produce reports or export your archive."
          icon={<TimelineIcon className="w-6 h-6" />}
          onClick={() => onNavigate('timeVortex')}
        />
        <DashboardTile
          title="Tag Editor"
          description="View and edit the people, pets, things and places of your life."
          icon={<TagsIcon className="w-6 h-6" />}
          onClick={() => onNavigate('tags')}
        />
        <DashboardTile
          title="Shared Memories"
          description={<>View {aiName}'s journals and reflections on your shared journey.</>}
          icon={<JournalIcon className="w-6 h-6" />}
          onClick={() => onNavigate('gigiJournal')}
        />
        <DashboardTile
          title="The Matrix"
          description="Upload, view, and organize your most precious photos and documents."
          icon={<GalleryIcon className="w-6 h-6" />}
          onClick={() => onNavigate('theMatrix')}
        />
        <DashboardTile
          title="Profile Editor"
          description="Manage your profile and customize your AI archivist's personality and defining prompts."
          icon={<ProfileIcon className="w-6 h-6" />}
          onClick={() => onNavigate('profile')}
        />
      </div>
    </div>
  );
};

export default Dashboard;
