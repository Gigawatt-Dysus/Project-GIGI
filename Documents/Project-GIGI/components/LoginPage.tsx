import React, { useState, useRef, useEffect } from 'react';
import { RestoreIcon } from './icons';
import type { User } from '../types';
import { appDataService } from '../services/serviceManager';
import { signIn, signUp } from '../services/authService';
import LoginHeader from './LoginHeader';

interface LoginPageProps {
    isFirebaseConfigured: boolean;
    onLogin: (user: User) => void;
    onDataImported: () => void;
    appResetToken: number;
}

type AuthMode = 'signIn' | 'signUp' | 'selectProfile';

type ImportStatus = 
  | { type: 'idle' }
  | { type: 'confirming', file: File }
  | { type: 'loading', message: string }
  | { type: 'success', message: string }
  | { type: 'error', message: string };

const LoginPage: React.FC<LoginPageProps> = ({ isFirebaseConfigured, onLogin, onDataImported, appResetToken }) => {
    const [authMode, setAuthMode] = useState<AuthMode>('signUp');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [importStatus, setImportStatus] = useState<ImportStatus>({ type: 'idle' });
    const backupImportFileRef = useRef<HTMLInputElement>(null);
    
    // For local mode
    const [localProfiles, setLocalProfiles] = useState<User[]>([]);
    const [isLocalProfileLoading, setIsLocalProfileLoading] = useState(!isFirebaseConfigured);

    useEffect(() => {
        const loadLocalProfiles = async () => {
            if (!isFirebaseConfigured) {
                setIsLocalProfileLoading(true);
                const profiles = await appDataService.getAllUserProfiles();
                setLocalProfiles(profiles);
                if (profiles.length > 0) {
                    setAuthMode('selectProfile');
                } else {
                    setAuthMode('signUp'); // Force sign up if no local profiles
                }
                setIsLocalProfileLoading(false);
            } else {
              setAuthMode('signUp'); // Default to sign up for firebase mode
            }
        };
        loadLocalProfiles();
    }, [isFirebaseConfigured, appResetToken]);

    // FIX: Add useEffect to reset internal state when a parent-driven reset occurs.
    // This prevents the "Restarting..." message from getting stuck after a backup import.
    useEffect(() => {
        if (appResetToken > 0) {
            setImportStatus({ type: 'idle' });
        }
    }, [appResetToken]);

    const handleAuthSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        const formData = new FormData(e.currentTarget);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;

        try {
            if (authMode === 'signUp') {
                const firstName = formData.get('firstName') as string;
                const lastName = formData.get('lastName') as string;
                if (!firstName || !lastName) {
                    throw new Error("First and last name are required for sign up.");
                }
                await signUp(email, password, firstName, lastName);
                // onAuthStateChanged in App.tsx will handle login
            } else {
                await signIn(email, password);
                // onAuthStateChanged in App.tsx will handle login
            }
        } catch (authError: any) {
            setError(authError.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleBackupFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImportStatus({ type: 'confirming', file });
        }
        e.target.value = '';
    };

    const handleStartBackupImport = async () => {
        if (importStatus.type !== 'confirming') return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                setImportStatus({ type: 'loading', message: 'Reading backup file...' });
                const data = JSON.parse(event.target?.result as string);
                setImportStatus({ type: 'loading', message: 'Restoring data...' });
                await appDataService.importBackupData(data);
                setImportStatus({ type: 'success', message: 'Data restored! Restarting...' });
                setTimeout(() => onDataImported(), 2000);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
                setImportStatus({ type: 'error', message: `Restore failed: ${errorMessage}` });
            }
        };
        reader.readAsText(importStatus.file);
    };
    
    const inputClasses = "mt-1 block w-full bg-gray-700/50 border-gray-500/30 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-400 sm:text-sm";

    return (
        <div
            className="min-h-screen flex flex-col text-center p-4"
        >
            <main className="flex-grow flex flex-col items-center justify-center py-8 z-10">
                <div className="w-full max-w-md bg-gray-900/70 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/10 button-glow">
                    
                    {importStatus.type !== 'idle' ? (
                         <div className="flex flex-col items-center justify-center min-h-[400px]">
                            {importStatus.type === 'confirming' && (
                                <div className="w-full text-left p-4 bg-gray-800 rounded-lg border border-violet-700">
                                    <p className="text-sm font-medium text-gray-200">Ready to restore from: <span className="font-bold text-white">{importStatus.file.name}</span></p>
                                    <p className="text-sm text-yellow-400 mt-2 font-semibold">Warning: This will overwrite ALL data, including user accounts. This action cannot be undone.</p>
                                    <div className="mt-4 flex gap-4 justify-end">
                                        <button onClick={() => setImportStatus({type: 'idle'})} className="px-4 py-1.5 text-sm font-semibold text-gray-200 hover:bg-white/10 rounded-lg">Cancel</button>
                                        <button onClick={handleStartBackupImport} className="px-4 py-1.5 text-sm font-semibold text-white bg-green-600 rounded-lg shadow-sm hover:bg-green-700">Confirm & Restore</button>
                                    </div>
                                </div>
                            )}
                            {(importStatus.type === 'loading' || importStatus.type === 'success' || importStatus.type === 'error') && (
                                <div className={`p-6 rounded-lg text-lg text-center ${
                                    importStatus.type === 'success' ? 'bg-green-900/50 text-green-200 border border-green-500'
                                    : importStatus.type === 'error' ? 'bg-red-900/50 text-red-200 border border-red-500'
                                    : 'bg-blue-900/50 text-blue-200 border border-blue-500'
                                }`}>
                                    <p>{importStatus.message}</p>
                                    {(importStatus.type === 'loading' || importStatus.type === 'success') && (
                                        <div className="mt-4 h-1 w-full bg-white/20 rounded-full overflow-hidden">
                                            <div className="h-1 bg-gradient-to-r from-green-400 to-violet-500 animate-pulse w-full"></div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <LoginHeader />
                            <p className="text-center text-gray-300 -mt-4 mb-6 text-sm max-w-xs mx-auto">
                                An AI-powered personal archivist to preserve, organize, and explore your life's most precious memories.
                            </p>
                            
                            {!isFirebaseConfigured && isLocalProfileLoading ? (
                                <p className="mt-4 text-gray-300 animate-pulse">Loading local profiles...</p>
                            ) : !isFirebaseConfigured && authMode === 'selectProfile' ? (
                                <div className="mt-6 space-y-3">
                                    <h2 className="text-lg text-gray-300">Choose a local profile.</h2>
                                    {localProfiles.map(profile => (
                                        <button key={profile.id} onClick={() => onLogin(profile)} className="w-full flex items-center gap-4 p-3 text-left bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                                            <img src={profile.profilePictureUrl} alt={profile.displayName} className="w-10 h-10 rounded-full object-cover" />
                                            <div>
                                                <p className="font-semibold text-white">{profile.displayName}</p>
                                                <p className="text-sm text-gray-300">{profile.email}</p>
                                            </div>
                                        </button>
                                    ))}
                                    <button onClick={() => setAuthMode('signUp')} className="w-full text-sm text-violet-400 hover:underline mt-2">Create new local profile</button>
                                </div>
                            ) : (
                                <>
                                    <h2 className="text-center text-lg text-gray-300">
                                        {authMode === 'signUp' ? 'Create Your Archive' : 'Open Your Archive'}
                                    </h2>
                                    <form onSubmit={handleAuthSubmit} className="mt-6 space-y-4 text-left">
                                        {authMode === 'signUp' && (
                                            <>
                                                <div>
                                                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-300 text-glow">First Name</label>
                                                    <input type="text" name="firstName" id="firstName" required className={inputClasses} />
                                                </div>
                                                <div>
                                                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-300 text-glow">Last Name</label>
                                                    <input type="text" name="lastName" id="lastName" required className={inputClasses} />
                                                </div>
                                            </>
                                        )}
                                        <div>
                                            <label htmlFor="email" className="block text-sm font-medium text-gray-300 text-glow">Email Address</label>
                                            <input type="email" name="email" id="email" required className={inputClasses} />
                                        </div>
                                        <div>
                                            <label htmlFor="password" className="block text-sm font-medium text-gray-300 text-glow">Password</label>
                                            <input type="password" name="password" id="password" required className={inputClasses} />
                                        </div>
                                        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
                                        <div className="pt-2">
                                            <button type="submit" disabled={isLoading} className="w-full px-6 py-3 bg-violet-600 text-white font-semibold rounded-lg shadow-md hover:bg-violet-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-white disabled:bg-violet-400 button-glow">
                                                {isLoading ? 'Processing...' : (authMode === 'signUp' ? 'Sign Up' : 'Sign In')}
                                            </button>
                                        </div>
                                    </form>

                                    <p className="text-center text-sm text-gray-300 mt-6">
                                        {authMode === 'signIn' ? "Don't have an account? " : "Already have an account? "}
                                        <button type="button" onClick={() => setAuthMode(authMode === 'signIn' ? 'signUp' : 'signIn')} className="font-semibold text-violet-400 hover:underline text-glow">
                                            {authMode === 'signIn' ? "Sign Up" : "Sign In"}
                                        </button>
                                    </p>
                                    
                                    <div className="relative my-6">
                                        <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-white/20"></div></div>
                                        <div className="relative flex justify-center"><span className="bg-gray-900/70 px-2 text-sm text-gray-400">Or</span></div>
                                    </div>
                                    
                                    <button onClick={() => backupImportFileRef.current?.click()} className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white/10 text-white font-semibold rounded-lg shadow-md hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-white button-glow">
                                        <RestoreIcon className="w-6 h-6" /> Restore from Backup
                                    </button>
                                    <input type="file" ref={backupImportFileRef} onChange={handleBackupFileSelected} className="hidden" accept=".json" />
                                </>
                            )}
                        </>
                    )}
                </div>
            </main>
            <footer className="flex-shrink-0 p-4 text-center text-gray-400 text-sm z-10">
                &copy; 2025 Project Gigi. Your memories, reimagined.
            </footer>
        </div>
    );
};

export default LoginPage;