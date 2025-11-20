import React, { useState, useEffect, useRef } from 'react';
import type { Tag, Media } from '../types';
import { PlusIcon, PencilIcon, TrashIcon, ReplaceIcon } from './icons';
import { base64ToBlob } from '../utils/fileUtils';
import TagCardViewer from './TagCardViewer';


interface TagCardProps {
  tag: Tag;
  media?: Media;
  isDeleting: boolean;
  onView: (tag: Tag) => void;
  onEdit: (tag: Tag) => void;
  onDelete: (tagId: string) => void;
  onReplace: (tag: Tag) => void;
}

export const TagTypeBadge: React.FC<{type: Tag['type']}> = ({ type }) => {
    const typeStyles: Record<Tag['type'], string> = {
        person: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        pet: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        place: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        thing: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
        event: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        unknown: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    };
    return (
        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full capitalize ${typeStyles[type]}`}>
            {type}
        </span>
    );
};

const TagCard: React.FC<TagCardProps> = ({ tag, media, isDeleting, onView, onEdit, onDelete, onReplace }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const objectUrlRef = useRef<string | null>(null);

  // This effect runs ONCE on mount and cleans up ONCE on unmount to prevent memory leaks.
  useEffect(() => {
    const ref = objectUrlRef;
    return () => {
        if (ref.current) {
            URL.revokeObjectURL(ref.current);
            ref.current = null;
        }
    };
  }, []);

  // This effect handles loading and changing the main image.
  useEffect(() => {
    setIsImageLoading(true);
    const char = tag.name ? tag.name.charAt(0).toUpperCase() : '?';
    const safeChar = encodeURIComponent(char);
    const placeholder = `https://dummyimage.com/400x300/8b5cf6/ffffff.png&text=${safeChar}`;
    
    if (media?.base64Data && media.fileType) {
        // Show placeholder and schedule the heavy work.
        setImageUrl(placeholder);

        const timer = setTimeout(() => {
            try {
                // This is a blocking operation, but it's deferred.
                const blob = base64ToBlob(media.base64Data!, media.fileType!);
                const newObjectUrl = URL.createObjectURL(blob);
                
                // Revoke the previous URL before setting the new one.
                if (objectUrlRef.current) {
                    URL.revokeObjectURL(objectUrlRef.current);
                }
                
                objectUrlRef.current = newObjectUrl;
                setImageUrl(newObjectUrl);
            } catch (error) {
                console.error(`Failed to decode image data for tag '${tag.name}', falling back to placeholder.`, error);
                setImageUrl(placeholder);
            } finally {
                setIsImageLoading(false);
            }
        }, 100); // 100ms delay to allow UI to render first.

        return () => clearTimeout(timer);

    } else {
        // No image data, just show the placeholder.
        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
        }
        setImageUrl(placeholder);
        setIsImageLoading(false);
    }
  }, [media, tag.name]);
  
  const cardClasses = isDeleting ? 'animate-dissolve' : '';

  return (
    <div onClick={() => onView(tag)} className={`bg-white dark:bg-gray-800/50 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 flex flex-col group relative cursor-pointer ${cardClasses}`}>
        {isImageLoading || !imageUrl ? (
             <div className="w-full h-40 bg-gray-200 dark:bg-gray-700 rounded-t-lg animate-pulse" />
        ) : (
            <img 
                src={imageUrl}
                alt={tag.name} 
                className="w-full h-40 object-cover rounded-t-lg bg-gray-200 dark:bg-gray-700"
            />
        )}
        <div className="p-4 flex-grow flex flex-col">
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 pr-2">{tag.name}</h3>
                <TagTypeBadge type={tag.type} />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 flex-grow">
                {tag.description ? `${tag.description.substring(0, 100)}${tag.description.length > 100 ? '...' : ''}` : <span className="italic">No description.</span>}
            </p>
        </div>
        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={(e) => { e.stopPropagation(); onReplace(tag); }} className="p-2 bg-white/80 dark:bg-gray-800/80 rounded-full shadow-md hover:bg-yellow-100 dark:hover:bg-yellow-900" title="Replace Tag">
                <ReplaceIcon className="w-5 h-5 text-yellow-700 dark:text-yellow-400" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onEdit(tag); }} className="p-2 bg-white/80 dark:bg-gray-800/80 rounded-full shadow-md hover:bg-violet-100 dark:hover:bg-violet-900" title="Edit Tag">
                <PencilIcon className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); window.confirm('Are you sure you want to permanently delete this tag? It will be removed from all associated events.') && onDelete(tag.id); }} className="p-2 bg-white/80 dark:bg-gray-800/80 rounded-full shadow-md hover:bg-red-100 dark:hover:bg-red-900" title="Delete Tag">
                <TrashIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
            </button>
        </div>
    </div>
  );
};


interface TagGalleryProps {
  tags: Tag[];
  media: Media[];
  tagBeingDeleted: string | null;
  onEditTag: (tag: Tag) => void;
  onCreateTag: () => void;
  onDeleteTag: (tagId: string) => void;
  onReplaceTag: (tag: Tag) => void;
  onDiscuss: (tag: Tag) => void;
}

const TagGallery: React.FC<TagGalleryProps> = ({ tags, media, tagBeingDeleted, onEditTag, onCreateTag, onDeleteTag, onReplaceTag, onDiscuss }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortType, setSortType] = useState<'name' | 'type'>('name');
    const [viewingTag, setViewingTag] = useState<Tag | null>(null);
    
    const mediaMap = new Map(media.map(m => [m.id, m]));

    const filteredAndSortedTags = tags
        .filter(tag => tag.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
            if (sortType === 'name') {
                return a.name.localeCompare(b.name);
            }
            return a.type.localeCompare(b.type);
        });
    
    const handleEditFromViewer = (tag: Tag) => {
        setViewingTag(null);
        onEditTag(tag);
    };

    return (
        <div className="relative">
            {viewingTag && (
                <TagCardViewer 
                    tag={viewingTag}
                    allMedia={media}
                    onClose={() => setViewingTag(null)}
                    onEdit={handleEditFromViewer}
                    onDiscuss={onDiscuss}
                />
            )}
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 text-glow">Your Tags</h1>
                <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">Organize the people, places, and things in your life story.</p>
            </div>

            <div className="flex flex-wrap justify-center items-center gap-4 mb-8">
                <button
                    onClick={onCreateTag}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-violet-600 rounded-lg shadow-sm hover:bg-violet-700 transition-colors"
                >
                    <PlusIcon className="w-4 h-4" />
                    Create New Tag
                </button>
                <div className="relative">
                    <input 
                        type="text"
                        placeholder="Search tags..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-4 pr-10 py-2 w-64 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-violet-500 focus:border-violet-500"
                    />
                </div>
            </div>

            {filteredAndSortedTags.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredAndSortedTags.map(tag => (
                        <TagCard 
                            key={tag.id} 
                            tag={tag} 
                            media={tag.mainImageId ? mediaMap.get(tag.mainImageId) : undefined}
                            isDeleting={tag.id === tagBeingDeleted}
                            onView={setViewingTag}
                            onEdit={onEditTag} 
                            onDelete={onDeleteTag} 
                            onReplace={onReplaceTag} 
                        />
                    ))}
                </div>
            ) : (
                 <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">No Tags Found</h3>
                    {searchTerm ? (
                        <p>Your search for "{searchTerm}" did not match any tags.</p>
                    ) : (
                        <p>You haven't created any tags yet. Click "Create New Tag" to get started!</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default TagGallery;