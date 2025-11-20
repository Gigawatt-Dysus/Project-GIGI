import React, { useState } from 'react';
import type { Theme, Settings } from '../types';
import { SunIcon, MoonIcon } from './icons';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: Settings;
    onSettingsChange: (newSettings: Settings) => void;
    theme: Theme;
    toggleTheme: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSettingsChange, theme, toggleTheme }) => {
    const [localSettings, setLocalSettings] = useState<Settings>(settings);

    if (!isOpen) return null;

    const handleSettingChange = (key: keyof Settings, value: any) => {
        setLocalSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSaveChanges = () => {
        onSettingsChange(localSettings);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Application Settings</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
                </div>
                
                <div className="p-6 space-y-6">
                    {/* Theme Settings */}
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Theme</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Choose between light and dark mode.</p>
                        </div>
                        <button onClick={toggleTheme} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                            {theme === 'light' ? <MoonIcon className="h-6 w-6" /> : <SunIcon className="h-6 w-6" />}
                        </button>
                    </div>

                    {/* Show Memory Prompt Toggle */}
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Show Memory Prompt</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Display a personalized conversation starter on the dashboard.</p>
                        </div>
                        <label htmlFor="showMemoryPromptToggle" className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="showMemoryPromptToggle" className="sr-only peer"
                                checked={localSettings.showMemoryPromptOnDashboard}
                                onChange={e => handleSettingChange('showMemoryPromptOnDashboard', e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-300 dark:peer-focus:ring-violet-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-violet-600"></div>
                        </label>
                    </div>

                    {/* AI Daydreaming Toggle */}
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="font-semibold text-gray-800 dark:text-gray-200">AI Daydreaming</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Allow AIs to reflect while you're idle.</p>
                        </div>
                        <label htmlFor="aiDaydreamingToggle" className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="aiDaydreamingToggle" className="sr-only peer"
                                checked={localSettings.aiDaydreaming}
                                onChange={e => handleSettingChange('aiDaydreaming', e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-300 dark:peer-focus:ring-violet-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-violet-600"></div>
                        </label>
                    </div>

                    {/* Idle Timeout */}
                    <div>
                        <label htmlFor="idleTimeout" className="block font-semibold text-gray-800 dark:text-gray-200">Idle Timeout</label>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Set status to "Away" and trigger AI daydreaming after this many minutes of inactivity.</p>
                        <div className="flex items-center gap-4">
                            <input type="range" id="idleTimeout" min="1" max="30" value={localSettings.idleTimeout}
                                onChange={e => handleSettingChange('idleTimeout', parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                            />
                            <span className="font-semibold text-gray-700 dark:text-gray-300 w-20 text-center">{localSettings.idleTimeout} min</span>
                        </div>
                    </div>

                    {/* Daydream Interval */}
                    <div>
                        <label htmlFor="daydreamInterval" className="block font-semibold text-gray-800 dark:text-gray-200">AI Daydream Frequency</label>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">How often the AIs should reflect when you are idle. (Approximate)</p>
                         <div className="flex items-center gap-4">
                            <input type="range" id="daydreamInterval" min="1" max="120" value={localSettings.daydreamInterval}
                                disabled={!localSettings.aiDaydreaming}
                                onChange={e => handleSettingChange('daydreamInterval', parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 disabled:opacity-50"
                            />
                            <span className="font-semibold text-gray-700 dark:text-gray-300 w-20 text-center">{localSettings.daydreamInterval} min</span>
                        </div>
                    </div>

                    {/* Auto Backup Interval */}
                    <div>
                        <label htmlFor="autoBackupInterval" className="block font-semibold text-gray-800 dark:text-gray-200">Automatic Backup Frequency</label>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Automatically save a full backup of your archive. Saved to your browser's default download location. Set to 0 to disable.</p>
                         <div className="flex items-center gap-4">
                            <input type="range" id="autoBackupInterval" min="0" max="60" step="5" value={localSettings.autoBackupInterval}
                                onChange={e => handleSettingChange('autoBackupInterval', parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                            />
                            <span className="font-semibold text-gray-700 dark:text-gray-300 w-24 text-center">{localSettings.autoBackupInterval > 0 ? `${localSettings.autoBackupInterval} min` : 'Off'}</span>
                        </div>
                    </div>

                </div>

                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-4 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
                    <button onClick={onClose} className="px-5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg">Cancel</button>
                    <button onClick={handleSaveChanges} className="px-6 py-2 bg-violet-600 text-white font-semibold rounded-lg shadow-md hover:bg-violet-700">Save Changes</button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;