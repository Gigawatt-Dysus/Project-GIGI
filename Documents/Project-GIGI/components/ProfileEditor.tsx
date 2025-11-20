import React, { useState, useRef, useEffect } from 'react';
import type { GigiPersona, User, View, Toast, Settings, Media, ImportStatus } from '../types';
import { ImageCropper } from './ImageCropper';
import { parseLegacyData } from '../services/importer';
import { appDataService } from '../services/serviceManager';
import { DisplaySettingsIcon, UploadIcon, RestoreIcon } from './icons';
import SettingsModal from './SettingsModal';
import { blobToBase64, base64ToBlob } from '../utils/fileUtils';

const InputField: React.FC<{
  label: string;
  id: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  pattern?: string;
}> = ({ label, id, name, value, onChange, type = 'text', autoComplete, required = false, pattern }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        <input
            type={type}
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            autoComplete={autoComplete}
            required={required}
            pattern={pattern}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-violet-500 focus:border-violet-500 sm:text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
    </div>
);

const Lightbox: React.FC<{ mediaItem: Media; onClose: () => void; }> = ({ mediaItem, onClose }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const objectUrlRef = useRef<string | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    useEffect(() => {
        const placeholder = 'https://dummyimage.com/800x600/e9d5ff/4c1d95.png&text=Loading...';
        setImageUrl(placeholder);

        const generateUrl = () => {
            if (mediaItem.base64Data && mediaItem.fileType) {
                try {
                    const blob = base64ToBlob(mediaItem.base64Data, mediaItem.fileType);
                    const newUrl = URL.createObjectURL(blob);
                    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
                    objectUrlRef.current = newUrl;
                    setImageUrl(newUrl);
                } catch (e) { console.error("Error creating lightbox blob", e); }
            } else {
                setImageUrl(mediaItem.url || mediaItem.thumbnailUrl || placeholder);
            }
        };
        generateUrl();

        return () => {
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
        };
    }, [mediaItem]);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4" onClick={onClose}>
            <button onClick={onClose} className="absolute top-4 right-4 text-white text-4xl leading-none font-bold hover:text-gray-300 z-10">&times;</button>
            <div className="relative max-w-5xl max-h-[90vh] w-full h-full" onClick={e => e.stopPropagation()}>
                {imageUrl ? <img src={imageUrl} alt={mediaItem.caption} className="max-w-full max-h-full object-contain mx-auto" /> : <div className="w-full h-full bg-gray-700 animate-pulse rounded-lg"/>}
                 {mediaItem.caption && <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2 text-center text-white text-sm">{mediaItem.caption}</div>}
            </div>
        </div>
    );
};

const GalleryImage: React.FC<{ media: Media, onClick: () => void }> = ({ media, onClick }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const objectUrlRef = useRef<string | null>(null);

    useEffect(() => {
        const placeholder = `https://dummyimage.com/150x150/e9d5ff/4c1d95.png&text=?`;
        let isMounted = true;

        const generateUrl = async () => {
            if (media.base64Data && media.fileType) {
                try {
                    const blob = base64ToBlob(media.base64Data, media.fileType);
                    const newUrl = URL.createObjectURL(blob);
                    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
                    objectUrlRef.current = newUrl;
                    if (isMounted) setImageUrl(newUrl);
                } catch (e) {
                    if (isMounted) setImageUrl(placeholder);
                }
            } else {
                if (isMounted) setImageUrl(media.thumbnailUrl || media.url || placeholder);
            }
        };

        generateUrl();

        return () => {
            isMounted = false;
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
        };
    }, [media]);

    if (!imageUrl) {
        return <div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />;
    }

    return (
        <button onClick={onClick} className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden group relative focus:outline-none focus:ring-2 focus:ring-violet-500">
            <img src={imageUrl} alt={media.caption} className="w-full h-full object-cover" />
        </button>
    );
};

interface ProfileEditorProps {
  user: User;
  onUserUpdate: (user: User) => void;
  onNavigate: (view: View) => void;
  addToast: (message: string, type: Toast['type']) => void;
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  allMedia: Media[];
  onSaveMedia: (media: Media) => void;
  onSimulateDigestEmail: () => void;
  onSimulateCompanionSms: () => void;
  onExportAllData: () => void;
  onTriggerRestore: () => void;
  onCreateUserPersonTag: () => void;
}

type ProfileTab = 'profile' | 'gallery' | 'controls';


const ProfileEditor: React.FC<ProfileEditorProps> = ({ user, onUserUpdate, onNavigate, addToast, settings, onSettingsChange, theme, toggleTheme, allMedia, onSaveMedia, onSimulateDigestEmail, onSimulateCompanionSms, onExportAllData, onTriggerRestore, onCreateUserPersonTag }) => {
  const [formData, setFormData] = useState<User>(user);
  const [profilePicPreview, setProfilePicPreview] = useState<string>(user.profilePictureUrl);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [legacyImportStatus, setLegacyImportStatus] = useState<ImportStatus>({ type: 'idle' });
  const [isResetting, setIsResetting] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [viewingMedia, setViewingMedia] = useState<Media | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('controls');


  const fileInputRef = useRef<HTMLInputElement>(null);
  const legacyImportFileRef = useRef<HTMLInputElement>(null);
  const galleryFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && user.id !== formData.id) {
        setFormData(user);
        setProfilePicPreview(user.profilePictureUrl);
    }
  }, [user, formData.id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    if (id.includes('.')) {
        const [parent, child] = id.split('.');
        setFormData(prev => ({ ...prev, [parent]: { ...(prev[parent as keyof User] as object), [child]: value } } as User));
    } else {
        setFormData(prev => ({ ...prev, [id]: value }));
    }
  };

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setImageToCrop(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleCropComplete = (croppedImageUrl: string) => {
    setProfilePicPreview(croppedImageUrl);
    setImageToCrop(null);
  };
  
  const handleSaveChanges = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const updatedUser: User = {
        ...formData,
        profilePictureUrl: profilePicPreview,
    };
    onUserUpdate(updatedUser);
    setIsSaving(false);
  };

  const handleLegacyFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        setLegacyImportStatus({ type: 'confirming', file });
    }
    e.target.value = '';
  };

  const handleStartLegacyImport = async () => {
    if (legacyImportStatus.type !== 'confirming') return;
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            setLegacyImportStatus({ type: 'loading', message: 'Parsing legacy data...' });
            const parsedData = parseLegacyData(event.target?.result as string);
            setLegacyImportStatus({ type: 'loading', message: 'Importing records to database...' });
            await appDataService.importLegacyData(user.id, parsedData);
            setLegacyImportStatus({ type: 'success', message: 'Legacy data imported successfully! Restarting app...' });
            addToast('Legacy data imported! Restarting...', 'success');
            // setTimeout(() => onDataImported(), 2000); // This should now be handled by App.tsx
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            setLegacyImportStatus({ type: 'error', message: `Import failed: ${errorMessage}` });
        }
    };
    reader.readAsText(legacyImportStatus.file);
  };

  const handleResetAndSeed = async () => {
    if (window.confirm('Are you sure you want to reset all Time Vortex data for this user? This will delete all events, tags, and media and replace them with the default mock data.')) {
        setIsResetting(true);
        try {
            await appDataService.resetAndSeedDatabase(user.id);
            addToast('Data has been reset and seeded successfully. The application will now restart.', 'success');
            // setTimeout(() => onDataImported(), 1500); // This should now be handled by App.tsx
        } catch (error) {
            console.error("Failed to reset and seed database:", error);
            addToast('An error occurred while resetting the data.', 'error');
            setIsResetting(false);
        }
    }
  };

  const handleGalleryFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
        let newMediaIds: string[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file) continue;

            const base64Data = await blobToBase64(file);
            const newMedia: Media = {
                id: `media-user-${user.id}-${Date.now()}-${Math.random()}`,
                url: '', thumbnailUrl: '',
                caption: file.name,
                uploadDate: new Date(),
                fileType: file.type, fileName: file.name, size: file.size,
                base64Data,
                tagIds: [],
            };
            onSaveMedia(newMedia);
            newMediaIds.push(newMedia.id);
        }

        setFormData(prev => ({
            ...prev,
            mediaIds: [...(prev.mediaIds || []), ...newMediaIds]
        }));
    } catch (error) {
        console.error("Error processing gallery upload:", error);
        addToast("Failed to upload one or more files.", "error");
    } finally {
        e.target.value = '';
    }
  };

  const userMedia = (formData.mediaIds || []).map(id => allMedia.find(m => m.id === id)).filter((m): m is Media => !!m);

  const TabButton: React.FC<{ tabName: ProfileTab; label: string }> = ({ tabName, label }) => (
    <button
        type="button"
        onClick={() => setActiveTab(tabName)}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tabName 
            ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300' 
            : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'}`}
    >
        {label}
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto relative">
      <SettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSettingsChange={onSettingsChange}
        theme={theme}
        toggleTheme={toggleTheme}
      />
      {imageToCrop && (
        <ImageCropper 
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={() => setImageToCrop(null)}
        />
      )}
      {viewingMedia && <Lightbox mediaItem={viewingMedia} onClose={() => setViewingMedia(null)} />}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 text-glow">Profile & Settings</h1>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">Manage your account and customize your experience.</p>
      </div>

      <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="bg-gray-900/80 text-white p-4 rounded-t-xl">
            <h1 className="text-2xl font-bold">{`${formData.firstName} ${formData.lastName}`}</h1>
        </div>
        
        <div className="p-6 md:p-8">
            <nav className="flex space-x-2 border-b border-gray-200 dark:border-gray-700 mb-6">
                <TabButton tabName="profile" label="Profile Info" />
                <TabButton tabName="gallery" label="My Gallery" />
                <TabButton tabName="controls" label="Controls" />
            </nav>
            
            {(activeTab === 'profile' || activeTab === 'gallery') && (
                <form onSubmit={handleSaveChanges}>
                    {activeTab === 'profile' && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="md:col-span-1 flex flex-col items-center">
                                    <img src={profilePicPreview} alt="Profile Preview" className="w-40 h-40 rounded-full object-cover shadow-md mb-4 border-4 border-white dark:border-gray-700"/>
                                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleProfilePicChange} className="hidden" />
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 text-sm font-medium text-violet-700 bg-violet-100 border border-transparent rounded-md hover:bg-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:hover:bg-violet-500/40">
                                        Change Image
                                    </button>
                                     <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">You can crop your image after uploading.</p>
                                </div>

                                <div className="md:col-span-2 space-y-4">
                                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-2">Your Information</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <InputField label="First Name" id="firstName" name="given-name" value={formData.firstName} onChange={handleInputChange} autoComplete="given-name" required />
                                        <InputField label="Last Name" id="lastName" name="family-name" value={formData.lastName} onChange={handleInputChange} autoComplete="family-name" required />
                                    </div>
                                     <InputField label="Display Name" id="displayName" name="nickname" value={formData.displayName} onChange={handleInputChange} autoComplete="nickname" required />
                                    <InputField label="Email" id="email" name="email" value={formData.email} onChange={handleInputChange} type="email" autoComplete="email" required />
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gender</label>
                                      <select id="gender" value={formData.gender || 'Prefer not to say'} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-violet-500 focus:border-violet-500 sm:text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                          <option>Prefer not to say</option>
                                          <option>Male</option>
                                          <option>Female</option>
                                          <option>Non-binary</option>
                                          <option>Other</option>
                                      </select>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Address</h3>
                                <div className="space-y-4 mt-4">
                                    <InputField label="Street Address" id="address.street" name="street-address" value={formData.address.street} onChange={handleInputChange} autoComplete="street-address" required />
                                    <InputField label="Address Line 2" id="address.address2" name="address-line2" value={formData.address.address2 || ''} onChange={handleInputChange} autoComplete="address-line2" />
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <InputField label="City" id="address.city" name="address-level2" value={formData.address.city} onChange={handleInputChange} autoComplete="address-level2" required />
                                        <InputField label="State" id="address.state" name="address-level1" value={formData.address.state} onChange={handleInputChange} autoComplete="address-level1" required />
                                        <InputField label="Zip Code" id="address.zip" name="postal-code" value={formData.address.zip} onChange={handleInputChange} autoComplete="postal-code" required pattern="\d{5}(-\d{4})?" />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                    {activeTab === 'gallery' && (
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">My Gallery</h3>
                             <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 my-4">
                                {userMedia.map(media => <GalleryImage key={media.id} media={media} onClick={() => setViewingMedia(media)} />)}
                            </div>
                            <input type="file" multiple ref={galleryFileInputRef} onChange={handleGalleryFileChange} className="hidden" accept="image/*,video/*,.pdf,.doc,.docx"/>
                            <button type="button" onClick={() => galleryFileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400 transition">
                                <UploadIcon className="w-5 h-5" />
                                <span>Upload Media</span>
                            </button>
                        </div>
                    )}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6 flex justify-end">
                        <button type="submit" disabled={isSaving} className="px-6 py-2 w-32 text-center bg-violet-600 text-white font-semibold rounded-lg shadow-md hover:bg-violet-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 disabled:bg-violet-400 dark:disabled:bg-violet-800">
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            )}

            {activeTab === 'controls' && (
                <div className="space-y-6">
                      <div className="flex justify-between items-center gap-4">
                        <div className="flex-grow">
                          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Application Settings</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Customize your AI companions, theme, and other app behaviors.</p>
                        </div>
                        <button onClick={() => setIsSettingsModalOpen(true)} className="flex-shrink-0 p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="Open Settings">
                            <DisplaySettingsIcon className="w-7 h-7 text-gray-600 dark:text-gray-300"/>
                        </button>
                      </div>

                       {!user.personTagId && (
                        <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-500/50">
                            <h4 className="font-semibold text-green-800 dark:text-green-300">Link Your Profile</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Create a "Person Tag" for yourself in the archive. This is required to build relationships with other people in your life story.
                            </p>
                            <div className="mt-3">
                                <button onClick={onCreateUserPersonTag} className="px-5 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg shadow-sm hover:bg-green-700">Create My Person Tag</button>
                            </div>
                        </div>
                      )}

                      <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-700/30 dark:border-gray-600">
                          <h4 className="font-semibold text-gray-800 dark:text-gray-200">AI & Data Management</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Create new AI personas, edit existing ones, and manage your archive data.
                          </p>
                          <div className="mt-3">
                              <button onClick={() => onNavigate('aiCompanionEditor')} className="px-5 py-2 text-sm font-semibold text-white bg-gigi-blue rounded-lg shadow-sm hover:opacity-90">Manage AI Companions</button>
                          </div>
                      </div>
                      <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-700/30 dark:border-gray-600">
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200">Communications Simulation</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            (Testing Only) Simulate Firebase Cloud Functions to generate and view AI digest messages. Messages appear in the Comms Center.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-4 items-center">
                           <button onClick={onSimulateDigestEmail} className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700">Generate Test Digest Email</button>
                           <button onClick={onSimulateCompanionSms} className="px-5 py-2 text-sm font-semibold text-blue-800 bg-blue-100 rounded-lg hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:hover:bg-blue-900/60">Generate Test Companion SMS</button>
                        </div>
                      </div>

                    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-700/30 dark:border-gray-600">
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200">Backup & Restore</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Save a complete snapshot of your archive or restore from a previous backup file.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-4 items-center">
                            <button onClick={onExportAllData} className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700">Export All Data</button>
                            <button onClick={onTriggerRestore} className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-blue-800 bg-blue-100 rounded-lg hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:hover:bg-blue-900/60">
                                <RestoreIcon className="w-5 h-5" />
                                Restore from Backup
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 p-4 border rounded-lg bg-gray-50 dark:bg-gray-700/30 dark:border-gray-600">
                            <h4 className="font-semibold text-gray-800 dark:text-gray-200">Import Legacy Data</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Import from an old Gigi data file (replaces current user's Time Vortex data only).</p>
                            <input type="file" ref={legacyImportFileRef} onChange={handleLegacyFileSelected} className="hidden" accept=".json, .js"/>
                            <button onClick={() => legacyImportFileRef.current?.click()} className="px-5 py-2 text-sm font-semibold text-white bg-teal-600 rounded-lg shadow-sm hover:bg-teal-700">Import Legacy File</button>
                            {legacyImportStatus.type !== 'idle' && (
                                <div className="mt-2">
                                    {legacyImportStatus.type === 'confirming' && (
                                        <div>
                                            <p className="text-sm">Ready to import: <strong>{legacyImportStatus.file.name}</strong>. This will replace Time Vortex data.</p>
                                            <div className="mt-2 flex gap-2">
                                              <button onClick={handleStartLegacyImport} className="text-sm font-semibold text-green-600 hover:underline">Confirm</button>
                                              <button onClick={() => setLegacyImportStatus({ type: 'idle' })} className="text-sm font-semibold text-gray-600 hover:underline">Cancel</button>
                                            </div>
                                        </div>
                                    )}
                                    {(legacyImportStatus.type === 'loading' || legacyImportStatus.type === 'success' || legacyImportStatus.type === 'error') && (
                                        <div className={`p-2 rounded-md text-sm ${
                                            legacyImportStatus.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200' :
                                            legacyImportStatus.type === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200' :
                                            'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200'
                                        }`}>{legacyImportStatus.message}</div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="space-y-2 p-4 border rounded-lg bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-500/50">
                            <h4 className="font-semibold text-red-800 dark:text-red-300">Danger Zone</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Reset your Time Vortex to its initial demo state. This is irreversible.</p>
                            <button 
                                onClick={handleResetAndSeed}
                                disabled={isResetting}
                                className="px-5 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg shadow-sm hover:bg-red-700 disabled:bg-red-400"
                            >
                                {isResetting ? 'Resetting...' : 'Reset & Seed Data'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ProfileEditor;