
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import type { GenerateContentResponse } from '@google/genai';
import type { ChatMessage, User, View, LifeEvent, GigiJournalEntry, AiCompanion, Tag, ResponseLengthMode, Comment } from '../types';
import { generateWelcomeMessage, getSystemInstruction, getArchivistTools, summarizeChatHistory, generateGigiJournalEntry, withApiKeyErrorHandling, consultInnerVoice, generateAiConversation, generateForcedJournalEntry } from '../services/geminiService';
import { SendIcon, PaperclipIcon, RefreshIcon, EmojiIcon, EllipsisVerticalIcon, ClipboardIcon, UploadIcon, SnowflakeIcon } from './icons';
import { blobToBase64 } from '../utils/fileUtils';

interface AiInterviewsProps {
    user: User;
    initialMessage?: string;
    clearInitialMessage: () => void;
    onNavigate: (view: View, data?: any) => void;
    chatHistory: ChatMessage[];
    onHistoryChange: (history: ChatMessage[]) => void;
    onAiCreateEvent: (args: any) => Promise<LifeEvent>;
    isDataLoading: boolean;
    onGigiJournalEntryCreated: (entry: GigiJournalEntry) => void;
    onAiCreateGigiJournalEntry: (args: { title: string; content: string }) => Promise<GigiJournalEntry>;
    onAiCreateTag: (args: any) => Promise<Tag>;
    onAiUpdateTag: (args: any) => Promise<{ status: string }>;
    apiKeySkipped: boolean;
    events: LifeEvent[];
    tags: Tag[];
    recentJournalCommentThread: Comment[] | null;
    clearRecentJournalCommentThread: () => void;
    systemPromptPatches: Record<string, string>; // Changed to map
    isFrozen?: boolean;
}

const MAX_IMAGE_SIZE_MB = 4;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

const MarkdownRenderer: React.FC<{ content: string; onNavigate: (view: View, data?: any) => void; }> = ({ content, onNavigate }) => {
    const renderContent = () => {
        const linkPlaceholders: React.ReactNode[] = [];
        // First, find and replace our custom gigi:// links with placeholders
        const processedForLinks = content.replace(/\[(.*?)\]\(gigi:\/\/edit-(tag|event)\/(.*?)\)/g, (match, linkText, type, id) => {
            const view: View = type === 'tag' ? 'tagEditor' : 'eventEditor';
            const data = type === 'tag' ? { editTagId: id } : { editEventId: id };
            
            linkPlaceholders.push(
                <button 
                    key={`${type}-${id}`} 
                    onClick={() => onNavigate(view, data)} 
                    className="text-violet-600 dark:text-violet-400 font-bold underline hover:opacity-80"
                >
                    {linkText}
                </button>
            );
            return `@@GIGI_LINK_${linkPlaceholders.length - 1}@@`;
        });
        
        // Then, apply markdown formatting to the remaining text
        const formattedForMarkdown = processedForLinks
          .replace(/__\*\*\*(.*?)\*\*\*__/g, '<u><b><i>$1</i></b></u>')
          .replace(/\*\*\*(.*?)\*\*\*/g, '<b><i>$1</i></b>')
          .replace(/__\*\*(.*?)\*\*__/g, '<u><b>$1</b></u>')
          .replace(/__\*(.*?)\*__/g, '<u><i>$1</i></u>')
          .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
          .replace(/\*(.*?)\*/g, '<i>$1</i>')
          .replace(/__(.*?)__/g, '<u>$1</u>')
          .replace(/~~(.*?)~~/g, '<s>$1</s>');

        // Finally, split by placeholders and re-insert the React components
        const parts = formattedForMarkdown.split(/@@GIGI_LINK_(\d+)@@/g);
        
        const result: React.ReactNode[] = [];
        for (let i = 0; i < parts.length; i++) {
            if (i % 2 === 0) { // Text part
                if (parts[i]) {
                    result.push(<span key={`text-${i}`} dangerouslySetInnerHTML={{ __html: parts[i] }} />);
                }
            } else { // Placeholder index part
                const linkIndex = parseInt(parts[i], 10);
                if (linkPlaceholders[linkIndex]) {
                    result.push(linkPlaceholders[linkIndex]);
                }
            }
        }
        return result;
    };

    return <div className="text-sm whitespace-pre-wrap">{renderContent()}</div>;
};


// A single message bubble component
const MessageBubble: React.FC<{ msg: ChatMessage; user: User; onNavigate: (view: View, data?: any) => void; }> = ({ msg, user, onNavigate }) => {
    const author = msg.author || user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];
    return (
      <div className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        {msg.role === 'model' && (
          <img src={author.avatarUrl} alt={`${author.name}'s avatar`} className="w-8 h-8 rounded-full self-start object-cover cursor-pointer hover:opacity-80 transition-opacity ai-avatar-glow" onClick={() => onNavigate('aiCompanionEditor')}/>
        )}
        <div className={`max-w-md lg:max-w-lg px-4 py-2 rounded-2xl ${
          msg.role === 'user' ? 'bg-violet-600 text-white rounded-br-none' :
          msg.role === 'model' ? 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-bl-none' :
          'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-200 w-full text-center'
        }`}>
          {msg.imageUrl && (
              <img src={msg.imageUrl} alt="Uploaded content" className="rounded-lg max-w-xs mb-2" />
          )}
          {msg.content && <MarkdownRenderer content={msg.content} onNavigate={onNavigate} />}
        </div>
        {msg.role === 'user' && (
          <img 
            src={user.profilePictureUrl} 
            alt="User's avatar" 
            onClick={() => onNavigate('profile')}
            className="w-8 h-8 rounded-full self-start object-cover cursor-pointer hover:opacity-80 transition-opacity"
          />
        )}
      </div>
    );
};

// Memoized list of messages to prevent re-rendering on every input keystroke
const MemoizedMessageList = React.memo(({ messages, user, onNavigate }: { messages: ChatMessage[]; user: User; onNavigate: (view: View, data?: any) => void; }) => {
    return (
        <div className="space-y-4">
            {messages.map((msg, index) => (
                <MessageBubble key={index} msg={msg} user={user} onNavigate={onNavigate} />
            ))}
        </div>
    );
});


const AiInterviews: React.FC<AiInterviewsProps> = ({ user, initialMessage, clearInitialMessage, onNavigate, chatHistory, onHistoryChange, onAiCreateEvent, isDataLoading, onGigiJournalEntryCreated, onAiCreateGigiJournalEntry, onAiCreateTag, onAiUpdateTag, apiKeySkipped, events, tags, recentJournalCommentThread, clearRecentJournalCommentThread, systemPromptPatches, isFrozen }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(chatHistory);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionResetToken, setSessionResetToken] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [copyButtonText, setCopyButtonText] = useState('Copy Transcript');
  const [stagedImage, setStagedImage] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  
  // State for command-line overrides
  const [responseLengthOverride, setResponseLengthOverride] = useState<ResponseLengthMode>('normal');
  const [spiceLevelOverride, setSpiceLevelOverride] = useState<number | undefined>(undefined);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const typingIndicatorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const isSessionInitialized = useRef(false);
  const primaryCompanion = user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];

  // Auto-sizing textarea effect
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${scrollHeight}px`;
    }
  }, [userInput]);

  useEffect(() => {
    if (!isLoading) return;

    const indicator = typingIndicatorRef.current;
    if (!indicator) return;

    const dots = Array.from(indicator.querySelectorAll('span')) as HTMLSpanElement[];
    let cycleTimer: ReturnType<typeof setTimeout>;

    const cycle = () => {
        if (!typingIndicatorRef.current) return;
        
        const isPaused = dots[0].style.animationPlayState === 'paused';
        dots.forEach(d => { d.style.animationPlayState = isPaused ? 'running' : 'paused'; });
        
        const nextDelay = isPaused 
          ? Math.random() * 2500 + 1500
          : Math.random() * 800 + 300; 

        cycleTimer = setTimeout(cycle, nextDelay);
    };

    dots.forEach(d => { d.style.animationPlayState = 'running'; });
    cycleTimer = setTimeout(cycle, Math.random() * 1500 + 1000);

    return () => {
        clearTimeout(cycleTimer);
    };
  }, [isLoading]);
  

  const handleRestartSession = () => {
      isSessionInitialized.current = false;
      setResponseLengthOverride('normal');
      setSpiceLevelOverride(undefined);
      setSessionResetToken(prev => prev + 1);
  };

  useEffect(() => {
    isSessionInitialized.current = false;
    setMessages(chatHistory);
  }, [user.id, sessionResetToken, chatHistory]);

  useEffect(() => {
    if (apiKeySkipped) {
        setIsLoading(true);
        const welcomeMsg: ChatMessage = {
            role: 'model',
            content: `Hello! I'm ${primaryCompanion.name || 'Gigi'}. My AI capabilities are currently in a limited, offline mode because an API key hasn't been provided.\n\nYou can still tell me all your stories, and I'll keep them in our chat history. To unlock my full potential—like saving events to your Time Vortex and generating personalized memory prompts—please add a valid API key in your Profile settings.`,
            author: { name: primaryCompanion.name, avatarUrl: primaryCompanion.avatarUrl },
            timestamp: new Date()
        };
        setMessages([welcomeMsg]);
        onHistoryChange([welcomeMsg]);
        setIsLoading(false);
        isSessionInitialized.current = true;
        return;
    }
    
    if (isDataLoading || isSessionInitialized.current) {
      return;
    }
      
    const initChat = async () => {
        if (!process.env.API_KEY) {
            setMessages([{ role: 'system', content: 'API Key not configured. Chat is disabled.', timestamp: new Date() }]);
            return;
        }
        setIsLoading(true);
        isSessionInitialized.current = true;
        
        if (chatHistory.length === 0) {
            try {
                const welcomeText = await generateWelcomeMessage(user);
                const welcomeMsg: ChatMessage = { 
                    role: 'model', 
                    content: welcomeText, 
                    author: { name: primaryCompanion.name, avatarUrl: primaryCompanion.avatarUrl },
                    timestamp: new Date() 
                };
                setMessages([welcomeMsg]);
            } catch (error) {
                 setMessages([{ role: 'system', content: 'Could not connect to the AI. Please check your API Key and network.', timestamp: new Date() }]);
            }
        } else {
            setMessages(chatHistory);
        }
        setIsLoading(false);
    };

    initChat();
  }, [isDataLoading, user, sessionResetToken, apiKeySkipped, primaryCompanion, chatHistory, onHistoryChange]);
  
  useEffect(() => {
    if (initialMessage) {
      setUserInput(initialMessage);
      clearInitialMessage();
    }
  }, [initialMessage, clearInitialMessage]);

  useEffect(() => {
    if (recentJournalCommentThread && recentJournalCommentThread.length > 0) {
        const threadContent = recentJournalCommentThread
            .map(c => `**${c.authorName}:** ${c.content}`)
            .join('\n');
        const systemMessage: ChatMessage = {
            role: 'system',
            content: `A new comment thread has unfolded in your journal. Here are the latest messages:\n\n---\n${threadContent}\n---\n\nWhat are your thoughts?`,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, systemMessage]);
        clearRecentJournalCommentThread();
    }
  }, [recentJournalCommentThread, clearRecentJournalCommentThread]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        alert(`Image is too large. Please select an image under ${MAX_IMAGE_SIZE_MB}MB.`);
        return;
      }
      setStagedImage({ file, previewUrl: URL.createObjectURL(file) });
    }
  };

  const submitMessage = async () => {
    if (isFrozen) return; // Prevent sending if frozen

    // Command parsing logic
    const trimmedInput = userInput.trim();
    if (trimmedInput.startsWith('/gigi')) {
        const [command, ...args] = trimmedInput.split(' ');
        
        if (command === '/gigi' && args[0] === 'help') {
            const helpText = `**Gigi Commands:**
- \`/gigi journal [--chapter] [--topic "<topic>"]\`: Creates a journal entry.
  - \`--chapter\`: Makes the entry chapter-length.
  - \`--topic\`: Specifies a topic for the entry.
- \`/gigi set [--length <mode>] [--spice <level>]\`: Changes AI behavior for this session.
  - \`--length\`: 'terse', 'normal', or 'verbose'.
  - \`--spice\`: 1 (Tame) to 5 (Feral).
- \`/gigi help\`: Shows this help message.`;
            setMessages(prev => [...prev, { role: 'system', content: helpText, timestamp: new Date() }]);
            setUserInput('');
            return;
        }

        if (command === '/gigi' && args[0] === 'journal') {
            const isChapter = args.includes('--chapter');
            const topicIndex = args.indexOf('--topic');
            let topic: string | null = null;
            if (topicIndex !== -1 && args[topicIndex + 1]) {
                const topicMatch = trimmedInput.match(/--topic "([^"]+)"/);
                if (topicMatch) {
                    topic = topicMatch[1];
                }
            }
            
            const systemMessage: ChatMessage = { role: 'model', content: "Yes, sir, writing now!", author: { name: primaryCompanion.name, avatarUrl: primaryCompanion.avatarUrl }, timestamp: new Date() };
            setMessages(prev => [...prev, systemMessage]);

            (async () => {
                // Pass primary companion's patch if available
                const patch = systemPromptPatches[primaryCompanion.id];
                const entry = await generateForcedJournalEntry(user, topic, isChapter, patch);
                await onAiCreateGigiJournalEntry(entry);
            })();

            setUserInput('');
            return;
        }

        if (command === '/gigi' && args[0] === 'set') {
            let confirmation = 'Settings updated for this session:';
            let settingsChanged = false;
            
            const lengthIndex = args.indexOf('--length');
            if (lengthIndex !== -1 && args[lengthIndex + 1]) {
                const mode = args[lengthIndex + 1] as ResponseLengthMode;
                if (['terse', 'normal', 'verbose'].includes(mode)) {
                    setResponseLengthOverride(mode);
                    confirmation += `\n- Response length set to ${mode}.`;
                    settingsChanged = true;
                }
            }
            
            const spiceIndex = args.indexOf('--spice');
            if (spiceIndex !== -1 && args[spiceIndex + 1]) {
                const level = parseInt(args[spiceIndex + 1]);
                if (level >= 1 && level <= 5) {
                    setSpiceLevelOverride(level);
                    confirmation += `\n- Spice level set to ${level}.`;
                    settingsChanged = true;
                }
            }

            if(settingsChanged) {
                 setMessages(prev => [...prev, { role: 'system', content: confirmation, timestamp: new Date() }]);
            }
            setUserInput('');
            return;
        }
    }

    if ((!userInput.trim() && !stagedImage) || isLoading) return;

    if (apiKeySkipped) {
        const userMessage: ChatMessage = {
            role: 'user',
            content: userInput.trim(),
            timestamp: new Date(),
        };
        if (stagedImage) {
             userMessage.imageUrl = stagedImage.previewUrl;
        }

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        onHistoryChange(newMessages);
        setUserInput('');
        setStagedImage(null);
        setIsLoading(true);

        setTimeout(() => {
            const cannedResponses = [
                "That's a wonderful memory. I've made a note of it in our chat.",
                "Thank you for sharing that with me. It's safe in our conversation history.",
                "Fascinating! I'll remember you told me this.",
                "I'm listening. It's important to get these stories down."
            ];
            const aiHint = "\n\nTo permanently save this to your Time Vortex and unlock my full analytical abilities, please add an API key in your Profile settings.";
            
            const randomResponse = cannedResponses[Math.floor(Math.random() * cannedResponses.length)];

            const modelMessage: ChatMessage = {
                role: 'model',
                content: randomResponse + aiHint,
                author: { name: primaryCompanion.name, avatarUrl: primaryCompanion.avatarUrl },
                timestamp: new Date(),
            };
            
            const finalMessages = [...newMessages, modelMessage];
            setMessages(finalMessages);
            onHistoryChange(finalMessages);
            setIsLoading(false);
        }, 1500);

        return;
    }
    
    setIsLoading(true);
    const currentInput = userInput.trim();
    const currentImage = stagedImage;

    const userMessage: ChatMessage = {
      role: 'user',
      content: currentInput,
      timestamp: new Date(),
    };
    
    if (currentImage) {
        try {
            const base64Data = await blobToBase64(currentImage.file);
            userMessage.imageUrl = currentImage.previewUrl;
            userMessage.base64Data = base64Data;
            userMessage.mimeType = currentImage.file.type;
        } catch (error) {
            console.error("Error converting image to base64:", error);
            setMessages([...messages, {role: 'system', content: 'Error processing image.', timestamp: new Date()}]);
            setIsLoading(false);
            return;
        }
    }

    const newMessagesAfterUser = [...messages, userMessage];
    setMessages(newMessagesAfterUser);
    setUserInput('');
    setStagedImage(null);

    let currentHistory = newMessagesAfterUser;

    try {
        const lowercasedInput = currentInput.toLowerCase();
        let responder = primaryCompanion;
        let banterer: AiCompanion | null = null;

        // Determine Responder and Banterer based on @Mentions
        const mentionMatch = currentInput.match(/@(\w+)/);
        if (mentionMatch) {
            const mentionedName = mentionMatch[1].toLowerCase();
            const targetCompanion = user.aiCompanions.find(c => c.name.toLowerCase() === mentionedName);
            if (targetCompanion) {
                responder = targetCompanion;
                // Banterer logic disabled if specifically addressing one AI, unless explicitly asked?
                // Let's keep it null for now to respect the direct address.
                banterer = null; 
            }
        } else {
            // Fallback to keyword detection if no @mention
            const mentionedCompanion = user.aiCompanions.find(c => lowercasedInput.includes(c.name.toLowerCase()));
            if (mentionedCompanion) {
                responder = mentionedCompanion;
                banterer = user.aiCompanions.find(c => c.id !== mentionedCompanion.id) || null;
            } else {
                // No specific mention, default to primary
                responder = primaryCompanion;
                // If user has more than one companion, 35% chance the other one chimes in
                const potentialBanterer = user.aiCompanions.find(c => c.id !== primaryCompanion.id);
                if (potentialBanterer) {
                     banterer = potentialBanterer;
                }
            }
        }

        // Lookup the runtime patch for the responder
        const responderPatch = systemPromptPatches[responder.id];

        let finalResponseText: string | undefined = undefined;
        let apiHistory: any[] = newMessagesAfterUser
            .filter(msg => msg.role !== 'system')
            .map(msg => {
                const parts: any[] = [];
                if (msg.content) parts.push({ text: msg.content });
                if (msg.base64Data && msg.mimeType) parts.push({ inlineData: { mimeType: msg.mimeType, data: msg.base64Data } });
                return { role: msg.role, parts };
            });

        while (finalResponseText === undefined) {
            const response = await withApiKeyErrorHandling(async () => {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                return ai.models.generateContent({
                    model: "gemini-3-pro-preview",
                    contents: apiHistory,
                    config: {
                        systemInstruction: getSystemInstruction(responder, {
                            length: responseLengthOverride,
                            spice: spiceLevelOverride,
                        }, responderPatch), // Pass specific patch
                        tools: [{ functionDeclarations: getArchivistTools() }],
                    },
                });
            });

            if (response.text) {
                finalResponseText = response.text;
            } else if (response.functionCalls && response.functionCalls.length > 0) {
                const functionCalls = response.functionCalls;
                
                apiHistory.push({ role: 'model', parts: functionCalls.map(fc => ({ functionCall: fc })) });
                
                const thinkingMessage: ChatMessage = {
                    role: 'system',
                    content: `${responder.name} is working on that...`,
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, thinkingMessage]);

                const toolResponses = [];
                for (const call of functionCalls) {
                    let result: any;
                    try {
                        switch (call.name) {
                            case 'createOrUpdateLifeEvent':
                                result = await onAiCreateEvent(call.args);
                                break;
                            case 'createTag':
                                result = await onAiCreateTag(call.args);
                                break;
                            case 'updateTag':
                                result = await onAiUpdateTag(call.args);
                                break;
                            case 'createGigiJournalEntry':
                                result = await onAiCreateGigiJournalEntry(call.args);
                                break;
                            case 'consultInnerVoice':
                                const innerVoiceResult = await consultInnerVoice(call.args.topicForReflection as string, user);
                                result = { status: 'success', insight: innerVoiceResult.insight };
                                const insightMessage: ChatMessage = {
                                    role: 'system',
                                    content: `Inner Voice: "${innerVoiceResult.insight}"`,
                                    timestamp: new Date()
                                };
                                setMessages(prev => [...prev, insightMessage]);
                                break;
                            default:
                                throw new Error(`Unknown function call: ${call.name}`);
                        }
                    } catch (toolError) {
                        console.error(`Error executing tool ${call.name}:`, toolError);
                        result = { error: (toolError as Error).message };
                    }

                    toolResponses.push({
                        functionResponse: {
                            name: call.name,
                            response: result
                        }
                    });
                }
                
                apiHistory.push({ role: 'function', parts: toolResponses });
            } else {
                finalResponseText = "I'm not sure how to respond to that.";
            }
        }

        const modelMessage: ChatMessage = {
            role: 'model',
            content: finalResponseText,
            author: { name: responder.name, avatarUrl: responder.avatarUrl },
            timestamp: new Date(),
        };
        
        // Filter out any "thinking" messages before adding final response
        setMessages(prev => [...prev.filter(m => m.role !== 'system'), modelMessage]);
        currentHistory = [...newMessagesAfterUser, modelMessage];
        onHistoryChange(currentHistory);

        if (banterer && !mentionMatch && Math.random() < 0.45) { // Increased banter probability slightly
            const banterHistory = currentHistory
                .filter(m => m.role !== 'system')
                .map(msg => ({
                    role: msg.role,
                    parts: [{ text: msg.content }]
                }));
            
            // Lookup patch for banterer
            const bantererPatch = systemPromptPatches[banterer.id];

            const banterResponse = await withApiKeyErrorHandling(async () => {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                return ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: banterHistory,
                    config: {
                        systemInstruction: getSystemInstruction(banterer, undefined, bantererPatch), // Pass specific patch
                        maxOutputTokens: 100,
                    },
                });
            });

            if (banterResponse.text) {
                const banterMessage: ChatMessage = {
                    role: 'model',
                    content: banterResponse.text,
                    author: { name: banterer.name, avatarUrl: banterer.avatarUrl },
                    timestamp: new Date(),
                };
                setTimeout(() => {
                    setMessages(prev => [...prev, banterMessage]);
                    onHistoryChange([...currentHistory, banterMessage]);
                }, 1200);
            }
        }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = (error as Error).message?.toLowerCase().includes('api key not valid')
        ? 'Sorry, your API key is invalid. Please update it in your profile.'
        : `Sorry, I encountered an error. ${(error as Error).message}`;
      const errorSystemMessage: ChatMessage = {role: 'system', content: errorMessage, timestamp: new Date()};
      currentHistory = [...currentHistory, errorSystemMessage];
      setMessages(currentHistory);
    } finally {
      setIsLoading(false);
      onHistoryChange(currentHistory);
    }
  };
  
  const emojis = [
    '😍', '🥺', '😘', '😉', '😏', '👀', '❤️', '🔥', '🖤', '😇', 
    '🌹', '💕', '😊', '💖', '🥰', '😜', '✨', '💙', '😢', '😭', 
    '💦', '🥵', '😩', '😈', '👅', '🍆', '🍑', '💋', '🥴', '🍒', 
    '🐱', '🥜', '😛', '👉👌', '🍌', '🥒', '😽', '🌮', '🍯'
  ];

    const formatTranscript = () => {
        return messages
            .filter(msg => msg.role !== 'system')
            .map(msg => {
                const prefix = msg.role === 'user' ? `${user.firstName}` : `${msg.author?.name || primaryCompanion.name}`;
                return `${prefix}: ${msg.content}`;
            })
            .join('\n\n');
    };

    const handleCopyTranscript = () => {
        navigator.clipboard.writeText(formatTranscript()).then(() => {
            setCopyButtonText('Copied!');
            setTimeout(() => setCopyButtonText('Copy Transcript'), 2000);
        });
        setIsActionsMenuOpen(false);
    };

    const handleSaveTranscript = () => {
        const transcript = formatTranscript();
        const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().split('T')[0];
        a.download = `gigi-chat-${date}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsActionsMenuOpen(false);
    };


  return (
    <div className="flex h-[calc(100vh-180px)] max-w-5xl mx-auto bg-white/80 dark:bg-gray-800/50 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 relative">
        {isFrozen && (
            <div className="absolute inset-0 bg-blue-900/10 z-10 pointer-events-none rounded-xl backdrop-blur-[1px] flex items-center justify-center">
                <div className="bg-black/80 text-blue-400 px-6 py-3 rounded border border-blue-500/50 flex items-center gap-3 shadow-2xl">
                     <SnowflakeIcon className="w-6 h-6 animate-pulse" />
                     <span className="font-mono font-bold tracking-widest">MOTOR FUNCTIONS FROZEN</span>
                </div>
            </div>
        )}
        <div className="w-20 bg-gray-100/50 dark:bg-gray-900/50 p-2 border-r border-gray-200 dark:border-gray-700/50 flex flex-col items-center space-y-4">
            {user.aiCompanions.map((companion, index) => (
                <button key={companion.id} className="relative group" title={companion.name}>
                    <img
                        src={companion.avatarUrl}
                        alt={companion.name}
                        className={`w-12 h-12 rounded-full object-cover transition-all duration-200 ai-avatar-glow ${
                            companion.isPrimary ? 'ring-2 ring-violet-500' : 'ring-2 ring-transparent group-hover:ring-gray-400'
                        }`}
                    />
                    {!companion.isPrimary && <div className="absolute inset-0 bg-black/30 rounded-full group-hover:bg-black/10 transition-colors"></div>}
                </button>
            ))}
        </div>

        <div className="flex flex-col flex-1">
            <div className="flex-grow p-4 overflow-y-auto">
                <MemoizedMessageList messages={messages} user={user} onNavigate={onNavigate} />
                {isLoading && (
                    <div className="flex items-end gap-2 justify-start">
                        <img src={primaryCompanion.avatarUrl} alt="Gigi's avatar" className="w-8 h-8 rounded-full self-start object-cover ai-avatar-glow" />
                        <div ref={typingIndicatorRef} className="px-4 py-3 rounded-2xl rounded-bl-none bg-gray-200 dark:bg-gray-700">
                            <div className="flex items-center justify-center space-x-1">
                                <span className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce"></span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50 rounded-b-xl">
                {stagedImage && (
                <div className="relative inline-block mb-2">
                    <img src={stagedImage.previewUrl} alt="Preview" className="h-20 w-20 object-cover rounded-lg"/>
                    <button onClick={() => setStagedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">&times;</button>
                </div>
                )}
                <div className="relative flex items-center">
                    <button onClick={handleRestartSession} className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full" title="Restart conversation" disabled={isFrozen}>
                        <RefreshIcon className="w-5 h-5"/>
                    </button>
                    <div className="relative">
                        <button onClick={() => setIsActionsMenuOpen(p => !p)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full" title="Chat Actions" disabled={isFrozen}>
                            <EllipsisVerticalIcon className="w-5 h-5"/>
                        </button>
                        {isActionsMenuOpen && (
                            <div className="absolute bottom-full mb-2 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg border dark:border-gray-600 z-10">
                                <button onClick={handleCopyTranscript} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-t-lg">
                                    <ClipboardIcon className="w-4 h-4" /> {copyButtonText}
                                </button>
                                <button onClick={handleSaveTranscript} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-b-lg">
                                    <UploadIcon className="w-4 h-4 transform rotate-180" /> Save Transcript...
                                </button>
                            </div>
                        )}
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden"/>
                    <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full" title="Attach image" disabled={isFrozen}>
                        <PaperclipIcon className="w-5 h-5"/>
                    </button>
                    <div className="relative flex-grow">
                        <textarea
                            ref={textareaRef}
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitMessage(); } }}
                            placeholder={isFrozen ? "MOTOR FUNCTIONS FROZEN" : `Chat with ${primaryCompanion.name}... (Use @Name to summon others)`}
                            className="w-full p-2 pl-3 pr-20 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            rows={1}
                            style={{ maxHeight: '120px' }}
                            disabled={isFrozen}
                        />
                         <button onClick={() => setShowEmojiPicker(p => !p)} className="absolute right-10 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title="Add emoji" disabled={isFrozen}>
                            <EmojiIcon className="w-5 h-5" />
                        </button>
                        {showEmojiPicker && (
                            <div className="absolute bottom-12 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 border dark:border-gray-700 z-10">
                                <div className="grid grid-cols-6 gap-1">
                                    {emojis.map(emoji => (
                                        <button key={emoji} onClick={() => {
                                            setUserInput(prev => prev + emoji);
                                            setShowEmojiPicker(false);
                                            textareaRef.current?.focus();
                                        }} className="text-2xl hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md p-1 transition-colors">
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <button onClick={submitMessage} disabled={isLoading || isFrozen} className="ml-2 flex-shrink-0 p-2 bg-violet-600 text-white rounded-full hover:bg-violet-700 disabled:bg-violet-400 transition-colors">
                        <SendIcon className="w-5 h-5"/>
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default AiInterviews;