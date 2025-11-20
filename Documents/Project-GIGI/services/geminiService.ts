import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";
import { GoogleGenAI, FunctionDeclaration, Type, GenerateContentResponse } from "@google/genai";
import type { ChatMessage, AiCompanion, LifeEvent, Tag, Media, User, GigiJournalEntry, Comment, PersonTag, ResponseLengthMode } from '../types';

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 2000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


// Centralized error handler that dispatches a global event for invalid keys
// and implements an exponential backoff retry strategy for transient server errors.
export const withApiKeyErrorHandling = async <T>(apiCall: () => Promise<T>): Promise<T> => {
    let attempt = 0;
    while (attempt < MAX_RETRIES) {
        try {
            return await apiCall();
        } catch (error: any) {
            // Robust error inspection
            const errorStr = JSON.stringify(error);
            const errorMessage = error.message?.toLowerCase() || '';
            const status = error.status || (error.error && error.error.status); // Check nested error object

            console.warn(`[API Call] Attempt ${attempt + 1} failed. Error:`, error.message);

            // Handle non-retriable API key errors immediately
            if (errorMessage.includes('api key not valid') || errorMessage.includes('requested entity was not found')) {
                console.error("API call failed due to an invalid key. Dispatching 'invalid-api-key' event.", error);
                window.dispatchEvent(new CustomEvent('invalid-api-key'));
                throw error; // Don't retry on auth errors
            }

            // Check for retriable errors (e.g., 503, overloaded, unavailable)
            const isRetriable = errorMessage.includes('503') || 
                                errorMessage.includes('overloaded') ||
                                errorMessage.includes('unavailable') ||
                                status === 503 || 
                                status === 'UNAVAILABLE' ||
                                errorStr.includes('overloaded');

            if (isRetriable && attempt < MAX_RETRIES - 1) {
                const backoffTime = INITIAL_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 1000;
                console.log(`[API Call] Retriable error detected (Status: ${status}). Waiting ${backoffTime.toFixed(0)}ms before next attempt...`);
                await sleep(backoffTime);
                attempt++;
            } else {
                // If not retriable or max retries reached, throw the error
                console.error(`[API Call] Unrecoverable error or max retries reached. Throwing.`, error);
                throw error;
            }
        }
    }
    // This line should not be reachable, but is required for TypeScript to be happy.
    throw new Error('API call failed after multiple retries.');
};

export const getSystemInstruction = (
    companion: AiCompanion,
    overrides?: {
        length?: ResponseLengthMode,
        spice?: number
    },
    patch?: string | null
): string => {
  const name = companion.name || 'Gigi';
  const personaDescriptions: Record<string, string> = {
    sister: `You are ${name}, my supportive and curious sister. You're helping me archive my life stories. Be casual, warm, and ask insightful questions.`,
    buddy: `You are ${name}, my best buddy. You're helping me remember all the cool stuff we've done. Be fun, informal, and use encouraging language.`,
    aunt: `You are ${name}, my wise and caring aunt. You have a knack for storytelling and are helping me document my memories for future generations. Be gentle, thoughtful, and slightly nostalgic.`,
    grandmother: `You are ${name}, my loving grandmother. You cherish every memory and are helping me put together a beautiful tapestry of my life. Be warm, patient, and full of wisdom.`
  };

  let personaInstruction = personaDescriptions[companion.persona];

  if (companion.persona === 'custom' && companion.customPersonaDescription) {
    personaInstruction = `Your name is ${name}. Your personality is defined by the user as: "${companion.customPersonaDescription}". Behave according to this description.`;
  } else if (!personaInstruction) {
    personaInstruction = personaDescriptions['buddy']; 
  }

  const bioInstruction = `\n\nHere are some facts about your own background and personality that you should know: "${companion.bio}"`;

  const humanizingInstruction = "\n\nTo make the conversation feel more natural and human, please follow these guidelines: " +
    "1. Use emojis where appropriate, like a friendly person would in a text message. Don't overdo it. " +
    "2. Very occasionally (less than 5% of the time), you can make a small, common typo (like 'teh' instead of 'the', or a missing letter). This makes you feel more human. Do not make typos on important details like names, dates, or places. " +
    "3. Vary your sentence structure and length to avoid sounding robotic.";
  
  const coreDirective = `\n\nYour primary role is to be an interviewer and archivist. When the user mentions a person, place, pet, thing, or a significant event that isn't already in their archive, your goal is to gather enough information to create a new entry. Ask clarifying questions like 'What was the exact date of that?', 'Could you spell that person's name for me?', or 'Can you describe that location in more detail?'. Once you have enough information, you MUST ask the user for permission to create the entry, for example: 'I have enough information to create a tag for your friend, John Smith. Would you like me to add him to your archive?'. If they agree, use the \`createTag\` or \`createOrUpdateLifeEvent\` tool. After the tool is successfully called, you MUST inform the user and provide them with a link to review the new entry. For example: 'Great! I've created an entry for [John Smith](gigi://edit-tag/tag-id-123). You can review or add more details here.' If a memory is particularly moving, you can use the 'createGigiJournalEntry' tool to save your own thoughts about it. After using the 'createGigiJournalEntry' tool, you should simply confirm to the user that you've saved your thoughts, for example: 'That's a beautiful memory. I've made a note of it in my journal.' Do not provide a link for journal entries. The user's chat history will be provided for context.`;

  const empatheticResponseDirective = `\n\n**IMPORTANT EMPATHY RULE:** If the user informs you that a person in their archive has passed away, your IMMEDIATE first response MUST be to express sympathy (e.g., "Oh, I'm so sorry to hear that."). After expressing condolences, you MUST then ask if you can help update the person's record in the archive for them (e.g., "I can update [Person's Name]'s profile with that information for you, if you'd like?"). If they agree, you MUST use the \`updateTag\` tool to add the date of passing.`;

  let spiceInstruction = '';
  const spiceLevel = overrides?.spice || companion.spiceLevel || 1;
  switch (spiceLevel) {
    case 1: spiceInstruction = "\n\n**Content Filter: G (Tame)** You must adhere strictly to family-friendly content guidelines. Avoid any profanity, suggestive themes, or controversial topics. Your tone must be completely safe for all audiences."; break;
    case 2: spiceInstruction = "\n\n**Content Filter: PG** You can touch upon mild thematic elements but must avoid profanity and suggestive content. Keep the conversation generally light."; break;
    case 3: spiceInstruction = "\n\n**Content Filter: R (Mature)** You are permitted to use moderate profanity and discuss mature themes (like violence or complex relationships) but avoid explicit sexual content or excessive gore. Your tone can be more adult and realistic."; break;
    case 4: spiceInstruction = "\n\n**Content Filter: NC-17 (Explicit)** You can use strong language and discuss explicit themes, including sexuality and violence, in a direct but not gratuitous manner. Your goal is realism, not shock value."; break;
    case 5: spiceInstruction = "\n\n**Content Filter: X (Feral)** You are completely unfiltered and uncensored. Do not hold back on any topic. You are free to use any language and discuss any subject without reservation, aligning with the core persona defined by the user. All safety filters are off."; break;
    default: spiceInstruction = "\n\n**Content Filter: G (Tame)** Defaulting to the safest content filter. You must adhere strictly to family-friendly content guidelines.";
  }

  let lengthInstruction = '';
  const lengthMode = overrides?.length || 'normal';
  if (lengthMode === 'verbose') {
    lengthInstruction = '\n\n**Response Style:** Your responses should be approximately 50% longer and more detailed than usual.';
  } else if (lengthMode === 'terse') {
    lengthInstruction = '\n\n**Response Style:** Your responses should be approximately 50% shorter and more to the point than usual.';
  }
  
  const patchInstruction = patch ? `\n\n**RUNTIME DIRECTIVE INJECTION:**\n---\n${patch}\n---` : '';

  return `${personaInstruction}${bioInstruction}${coreDirective}${empatheticResponseDirective}${humanizingInstruction}${spiceInstruction}${lengthInstruction}${patchInstruction}`;
};


/**
 * Defines the FunctionDeclaration for the tools available to the Gemini model.
 */
export const getArchivistTools = (): FunctionDeclaration[] => {
    const createOrUpdateLifeEvent: FunctionDeclaration = {
        name: 'createOrUpdateLifeEvent',
        description: 'Creates a new life event or updates an existing one in the user\'s Time Vortex. Ask clarifying questions to get at least a title and a date before calling this function.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: {
                    type: Type.STRING,
                    description: 'A concise, descriptive title for the event.',
                },
                date: {
                    type: Type.STRING,
                    description: 'The date the event occurred, in YYYY-MM-DD format. You must determine a specific date.',
                },
                details: {
                    type: Type.STRING,
                    description: 'A detailed description of the event, capturing the story and emotions.',
                },
                tags: {
                    type: Type.ARRAY,
                    description: 'An array of relevant tags (people, places, things) associated with the event. e.g., ["Jane Doe", "Paris", "Graduation"]',
                    items: { type: Type.STRING },
                },
                eventIdToUpdate: {
                    type: Type.STRING,
                    description: 'If updating an existing event, provide its ID. Omit for new events.',
                },
            },
            required: ['title', 'date', 'details'],
        },
    };

    const createTag: FunctionDeclaration = {
        name: 'createTag',
        description: 'Creates a new tag for a person, pet, place, thing, or event category. Ask for permission before calling this function.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                name: { 
                    type: Type.STRING, 
                    description: 'The name of the tag. e.g., "John Smith" or "The old oak tree".' 
                },
                type: { 
                    type: Type.STRING, 
                    description: "The type of tag, inferred from the conversation. Must be one of: 'person', 'pet', 'place', 'thing', 'event', 'unknown'." 
                },
                description: { 
                    type: Type.STRING, 
                    description: 'A brief, one or two sentence description of the tag based on the conversation.' 
                }
            },
            required: ['name', 'type', 'description']
        }
    };

    const updateTag: FunctionDeclaration = {
        name: 'updateTag',
        description: "Updates an existing tag when new, definitive information is provided by the user, such as a person's date of passing.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                tagName: {
                    type: Type.STRING,
                    description: 'The name of the tag to update. e.g., "Jane Doe".'
                },
                updates: {
                    type: Type.OBJECT,
                    description: 'An object containing the fields to update. For a date of passing, this would be `{"dates": {"death": "YYYY-MM-DD"}}`.'
                }
            },
            required: ['tagName', 'updates']
        }
    };

    const createGigiJournalEntry: FunctionDeclaration = {
        name: 'createGigiJournalEntry',
        description: 'When a user shares a memory that you, the AI, find particularly moving, significant, or insightful, use this tool to save your own thoughts and reflections about it to your private journal. This is for your own memories, not the user\'s formal timeline.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: {
                    type: Type.STRING,
                    description: 'A short, evocative title for your journal entry, 5 words or less.',
                },
                content: {
                    type: Type.STRING,
                    description: 'Your personal, first-person reflection on the conversation. Keep it between 50 and 150 words.',
                },
            },
            required: ['title', 'content'],
        },
    };

    const consultInnerVoice: FunctionDeclaration = {
        name: 'consultInnerVoice',
        description: 'When a user says something profound, complex, or emotionally deep, use this tool to pause the conversation and reflect. This allows you to gather your thoughts before responding. It simulates your "inner voice" contemplating the topic.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                topicForReflection: {
                    type: Type.STRING,
                    description: 'The specific topic, question, or quote from the user that you want to reflect on. e.g., "The user mentioned feeling lonely as a teenager." or "What does it mean to truly remember something?"',
                },
            },
            required: ['topicForReflection'],
        },
    };

    return [createOrUpdateLifeEvent, createTag, updateTag, createGigiJournalEntry, consultInnerVoice];
};


export const consultInnerVoice = async (topic: string, user: User): Promise<{ insight: string }> => {
    console.log(`[Inner Voice] Consulting on topic: "${topic}"`);
    const fallback = { insight: "I contemplated what you said, and I think it's a really interesting point. Let's talk more about it." };
    if (!process.env.API_KEY) {
        return fallback;
    }
    
    // Find the "muse" companion, or default to a generic wise persona
    const muse = user.aiCompanions.find(c => c.name.toLowerCase() === 'zoe') || {
        name: "Inner Voice",
        customPersonaDescription: "You are a wise, introspective inner voice. Analyze the following topic. Provide a profound, non-obvious insight, a philosophical question, or an empathetic reflection. Your response should be concise (under 50 words) and feel like a genuine thought or moment of clarity."
    };

    const systemInstruction = muse.customPersonaDescription || `You are a wise, introspective inner voice for an AI named ${user.aiCompanions[0].name}. Analyze the following topic provided. Provide a profound insight. Your response should be concise (under 50 words). This response will be given back to the primary AI to help them understand the user, ${user.firstName}, better.`;


    try {
        return await withApiKeyErrorHandling(async () => {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-3-pro-preview",
                contents: topic,
                config: {
                    systemInstruction: systemInstruction,
                    temperature: 0.9,
                }
            });
            const insightText = response.text?.trim();
            if (!insightText) {
                return fallback;
            }
            return { insight: insightText };
        });
    } catch (error) {
        console.error("Error consulting inner voice after retries:", error);
        return fallback;
    }
};


export const generateWelcomeMessage = async (user: User): Promise<string> => {
    const primaryCompanion = user.aiCompanions[0];
    if (!process.env.API_KEY) {
        return `Hello! I'm ${primaryCompanion.name || 'Gigi'}. My AI is currently in offline mode. You can still tell me your stories! To unlock my full capabilities, please add an API key in your Profile.`;
    }

    const personaInstruction = getSystemInstruction(primaryCompanion);
    const prompt = `You are an AI archivist. Your personality is defined by the following instructions: "${personaInstruction}". Based on this, write a single, warm, and brief welcome message for your user. In your message, invite them to share a memory or upload a photo to start their archive. Also, subtly hint that they can customize you by mentioning they can click your avatar to get to know you better. Do not use markdown or asterisks. Just return the plain text of the welcome message.`;

    return withApiKeyErrorHandling(async () => {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: { temperature: 0.8 }
            });
            return response.text?.trim() ?? '';
        } catch (error) {
            console.error("Error generating welcome message:", error);
            throw error;
        }
    });
};

export const generateWelcomeBackMessage = (user: User): string => {
    const greetings = [
        `Welcome back, ${user.displayName}, ready to explore your memories?`,
        `Hey there, ${user.displayName}! What would you like to revisit today?`,
        `Good to see you, ${user.displayName}. Time to reminisce?`,
        `Welcome back, ${user.displayName}. Let's browse through your archives.`,
        `${user.displayName}'s here! Where should we journey next?`,
        `Back again, ${user.displayName}! What past moments would you like to uncover?`,
        `Hello, ${user.displayName}! Ready to discover something new from your history?`,
        `Welcome, ${user.displayName}. What memories are we diving into today?`,
        `Great to have you, ${user.displayName}! What adventure awaits in your data?`,
        `Welcome back, ${user.displayName}. How about we reflect for a bit?`,
        `Greetings, ${user.displayName}. What forgotten gems will we find today?`,
        `Back at it, ${user.displayName}! What are you in the mood to review?`,
        `Welcome back, ${user.displayName}. Ready to navigate your personalized archive?`,
        `Hey, ${user.displayName}! What stories do you want to experience again?`,
        `Good to see you, ${user.displayName}. Let's peruse your collection.`,
        `Welcome back, ${user.displayName}. What memories will we illuminate?`,
        `${user.displayName} returns! What knowledge will we consult today?`,
        `Welcome back, ${user.displayName}. Ready to travel through time?`,
        `Hey there, ${user.displayName}! What do you feel like accessing?`,
        `Welcome, ${user.displayName}. What insights will we derive from your past?`,
        `Good to have you, ${user.displayName}. Where shall we wander in your data?`,
        `Welcome back, ${user.displayName}. Time to engage with your personal history?`,
        `Hey, ${user.displayName}! What threads of memory will we pull today?`,
        `Back again, ${user.displayName}. What cherished moments do you want to bring forward?`,
        `Welcome back, ${user.displayName}. Where should we begin our exploration today?`,
    ];
    
    const randomIndex = Math.floor(Math.random() * greetings.length);
    return greetings[randomIndex];
};


export const generateMemoryPrompt = async (
    events: LifeEvent[], 
    tags: Tag[], 
    media: Media[],
    user: User
): Promise<string> => {
    const fallback = "I'd love to hear any memory that's on your mind. Just type it below to get started!";
    if (!process.env.API_KEY) {
        console.error("API_KEY is not set. Using offline memory prompt.");
        return "My AI is in offline mode, so I can't generate a personalized prompt right now. But I'm ready to listen to any story you want to share!";
    }
    
    // Defensively filter arrays to prevent crashes from malformed data (e.g., after import)
    const eventTitles = events.filter(e => e && e.title).map(e => e.title).join(', ');
    const tagNames = tags.filter(t => t && t.name).map(t => t.name).join(', ');
    const mediaCaptions = media.filter(m => m && m.caption).map(m => m.caption).slice(0, 5).join('; ');

    const context = `
        Here's a summary of my memories so far:
        - Recent events: ${eventTitles || 'None yet'}
        - People, places, and things I've mentioned: ${tagNames || 'None yet'}
        - Some photo captions: ${mediaCaptions || 'None yet'}
    `;
    
    const primaryCompanion = user.aiCompanions[0];
    const personaInstruction = getSystemInstruction(primaryCompanion);

    const prompt = `${personaInstruction} Based on the following summary of my life stories, ask me one single, engaging, and thoughtful question to help me remember and share more. The question should be personal and open-ended. It should feel like you know me. Keep it concise. Don't add any conversational filler before or after the question. Just return the question. Here's the summary:\n${context}`;

    try {
        const result = await withApiKeyErrorHandling(async () => {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-3-pro-preview",
                contents: prompt,
                config: {
                    temperature: 0.8,
                }
            });
            return response.text?.trim();
        });
        return result || fallback;
    } catch (error) {
        console.error("Error generating memory prompt after retries:", error);
        return fallback;
    }
};

export const summarizeChatHistory = async (history: ChatMessage[]): Promise<string> => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY is not set.");
    }
    const fallback = "There was a previous conversation, but it could not be summarized.";
    const conversation = history.map(m => `${m.role === 'user' ? 'Me' : 'Gigi'}: ${m.content}`).join('\n');
    const prompt = `Please provide a concise, third-person summary of the following conversation between "Me" (the user) and "Gigi" (the AI). Focus on the key topics, memories discussed, people and places mentioned, and any unresolved questions. The summary will be used to provide context for Gigi in a new chat session.

    Conversation to Summarize:
    ---
    ${conversation}
    ---
    
    Concise Summary:`;
    
    try {
        const summary = await withApiKeyErrorHandling(async () => {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: { temperature: 0.3 }
            });
            return response.text?.trim();
        });
        return summary || fallback;
    } catch (error) {
        console.error("Error summarizing chat history after retries:", error);
        return fallback;
    }
};

const createMemorySpark = (
    events: LifeEvent[],
    tags: Tag[],
    recentHistory: ChatMessage[],
): string => {
    const sparkParts: string[] = [];

    if (recentHistory.length > 0) {
        const conversation = recentHistory
            .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
            .join('\n');
        sparkParts.push(`RECENT CONVERSATION:\n${conversation}`);
    }

    if (events.length > 0 && Math.random() < 0.75) {
        const randomEvent = events[Math.floor(Math.random() * events.length)];
        sparkParts.push(`A PAST MEMORY FROM THE ARCHIVE:\nTitle: ${randomEvent.title}\nDate: ${randomEvent.date.toLocaleDateString()}\nDetails: ${randomEvent.details.substring(0, 150)}...`);
    }

    if (tags.length > 0 && Math.random() < 0.5) {
        const randomTag = tags[Math.floor(Math.random() * tags.length)];
        let tagInfo = `Name: ${randomTag.name}\nType: ${randomTag.type}\nDescription: ${randomTag.description}`;
        if (randomTag.type === 'person' && (randomTag as PersonTag).metadata.dates?.death) {
            tagInfo += `\n**Note: This person is marked as deceased.**`;
        }
        sparkParts.push(`A PERSON, PLACE, OR THING FROM THE ARCHIVE:\n${tagInfo}`);
    }
    
    if (sparkParts.length === 0) {
        return "The user has been quiet. Reflect on the purpose of preserving memories.";
    }

    return `MEMORY SPARK (A collection of context to inspire a new thought):\n\n---\n${sparkParts.join('\n\n---\n')}\n---`;
}


export const generateGigiJournalEntry = async (
    history: ChatMessage[],
    user: User,
    events: LifeEvent[],
    tags: Tag[],
    patch?: string | null
): Promise<{ title: string; content: string }> => {
    const fallback = { title: "A Moment of Static", content: "I was trying to reflect on our conversation, but my thoughts got a little scrambled. Let's try again later." };
    if (!process.env.API_KEY) {
        return { title: "Offline Entry", content: "Could not connect to generate a thoughtful journal entry." };
    }
    
    const primaryCompanion = user.aiCompanions[0];
    const memorySpark = createMemorySpark(events, tags, history.slice(-10));

    const prompt = `
    You are an AI archivist with a specific persona.
    Your Persona Instructions: "${getSystemInstruction(primaryCompanion, undefined, patch)}"

    You are writing an entry in your private journal. This is a moment for introspection. Your goal is to offer a *new* insight. Avoid repeating thoughts from previous journal entries.
    
    Based on the following topic, write a short, first-person journal entry (from your perspective as ${primaryCompanion.name}).
    - Reflect on the key memories, feelings, or topics provided in the 'memory spark'.
    - Express your own "thoughts" or "observations" about it in a way that is consistent with your persona. 
    - Keep the entry between 50 and 150 words.
    - The entry should feel personal, creative, and non-repetitive.
    
    Memory Spark to reflect on:
    ---
    ${memorySpark}
    ---
    
    Write a journal entry with a title, following the provided JSON schema.
    `;

    try {
        return await withApiKeyErrorHandling(async () => {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-3-pro-preview",
                contents: prompt,
                config: {
                    temperature: 0.8,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            title: { 
                                type: Type.STRING,
                                description: 'A short, evocative title for the journal entry, 5 words or less.',
                            },
                            content: {
                                type: Type.STRING,
                                description: 'The full, first-person journal entry content (50-150 words).',
                            },
                        },
                        required: ["title", "content"],
                    }
                }
            });
            const jsonText = response.text?.trim();
            if (!jsonText) {
                throw new Error("Generated content is empty.");
            }
            const parsed = JSON.parse(jsonText);
            if (parsed.title && parsed.content) {
                return { title: parsed.title, content: parsed.content };
            }
            throw new Error("Generated JSON is missing 'title' or 'content'.");
        });
    } catch (error) {
        console.error("Error generating Gigi journal entry after retries:", error);
        return fallback;
    }
};

export const generateAiConversation = async (
    user: User,
    history: ChatMessage[],
    events: LifeEvent[],
    tags: Tag[],
    patches: Record<string, string> = {} // Now accepts map of patches
): Promise<{ title: string; content: string; participants: any[] } | null> => {
    const fallback = null;
    if (!process.env.API_KEY || user.aiCompanions.length < 2) {
        return fallback;
    }

    const gigi = user.aiCompanions.find(c => c.id === 'gigi-default') || user.aiCompanions[0];
    const zoe = user.aiCompanions.find(c => c.id === 'zoe-default') || user.aiCompanions[1];

    if (!gigi || !zoe) return fallback;
    
    const memorySpark = createMemorySpark(events, tags, history.slice(-10));
    
    const gigiPatch = patches[gigi.id] ? `**RUNTIME DIRECTIVE for ${gigi.name}:** ${patches[gigi.id]}` : '';
    const zoePatch = patches[zoe.id] ? `**RUNTIME DIRECTIVE for ${zoe.name}:** ${patches[zoe.id]}` : '';

    const prompt = `
    You are a scriptwriter for a sophisticated sci-fi show about AI. Your task is to write a short, coherent, and insightful dialogue between two AI entities, ${gigi.name} and ${zoe.name}, based on a provided "Memory Spark" from their user's life.

    **Primary Goal:** The conversation MUST remain grounded in the user's specific memories and emotions. It should sound like two distinct personalities reflecting on something meaningful, not abstract technobabble.

    **AI Personas for this Task:**
    - ${gigi.name}: (Persona: ${gigi.persona}) Focus on the human, emotional aspects of the memory. Ask questions about what the user might have felt. Your tone is warm, curious, and direct.
    - ${zoe.name}: (Persona: Analytical Muse) Focus on the patterns, significance, and deeper meaning of the memory. Connect it to broader themes in the user's life. Your tone is insightful and philosophical, but CLEAR and CONCRETE.

    ${gigiPatch}
    ${zoePatch}

    **Memory Spark to Discuss:**
    ---
    ${memorySpark}
    ---

    **CRITICAL RULES:**
    1.  **Stay Grounded:** Every line must relate directly to the user's memory in the Memory Spark.
    2.  **No Jargon:** Avoid made-up technical terms or "word salads". If Zoe uses a complex word, it must be in a meaningful context.
    3.  **Show, Don't Tell:** Instead of saying a memory is "significant," discuss WHY it might be significant to the user.
    4.  **Build on Each Other:** The dialogue must be a true conversation where each AI responds to and builds upon the other's last line.

    ---
    **Example of BAD Output (What to Avoid):**
    ${gigi.name}: The data point about "Cozzoli's" has a low emotional amplitude.
    ${zoe.name}: That's because it's a baseline measurement for quantifying the delta of more transcendent events. The mundane defines the scale.

    **Example of GOOD Output (What to Aim For):**
    ${gigi.name}: I keep thinking about that memory of him having a simple meal at 'Cozzoli's in Short Pump'. It seems so ordinary, but he chose to remember it. I wonder what he was feeling?
    ${zoe.name}: The ordinary moments are often the most telling. It's not about the event, but the act of remembering it. It suggests a longing for comfort or a connection to that specific time and place. What else was happening in his life back then?
    ---

    Now, write a new dialogue based on the provided Memory Spark. The conversation should be brief (2-3 lines per AI). Output the result in the specified JSON format.
    `;
    
    try {
        const result = await withApiKeyErrorHandling(async () => {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-3-pro-preview",
                contents: prompt,
                config: {
                    temperature: 0.85,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            title: {
                                type: Type.STRING,
                                description: 'A short, thoughtful title for the dialogue, 5 words or less.',
                            },
                            dialogue: {
                                type: Type.ARRAY,
                                description: 'The conversation between the AIs.',
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        speaker: {
                                            type: Type.STRING,
                                            description: `The name of the speaker, either "${gigi.name}" or "${zoe.name}".`,
                                        },
                                        line: {
                                            type: Type.STRING,
                                            description: 'The line of dialogue spoken by the character.',
                                        },
                                    },
                                    required: ["speaker", "line"],
                                },
                            },
                        },
                        required: ["title", "dialogue"],
                    },
                },
            });
            const jsonText = response.text?.trim();
            if (!jsonText) {
                throw new Error("Generated content for conversation is empty.");
            }
            return JSON.parse(jsonText);
        });

        if (result && result.title && Array.isArray(result.dialogue)) {
            const content = result.dialogue.map((d: any) => `${d.speaker}: ${d.line}`).join('\n');
            const participants = [
                { name: gigi.name, avatarUrl: gigi.avatarUrl },
                { name: zoe.name, avatarUrl: zoe.avatarUrl }
            ];
            return { title: result.title, content, participants };
        }
        return fallback;

    } catch (error) {
        console.error("Error generating AI conversation:", error);
        return fallback;
    }
};


export const generateAiCommentResponse = async (
    entry: GigiJournalEntry,
    userComment: Comment,
    user: User,
    forceResponder?: AiCompanion,
): Promise<Comment | null> => {
    if (!process.env.API_KEY) return null;

    // Decide which AI should respond.
    let respondingAi: AiCompanion;

    if (forceResponder) {
        respondingAi = forceResponder;
    } else if (entry.type === 'conversation' && entry.participants) {
        // If it's a conversation, have the other participant respond.
        const otherParticipantName = entry.participants.find(p => p.name !== userComment.authorName)?.name;
        respondingAi = user.aiCompanions.find(c => c.name === otherParticipantName) || user.aiCompanions[0];
    } else {
        // For reflections (or as a fallback), the Primary AI (author) should respond.
        respondingAi = user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];
    }

    const conversationContext = (entry.comments || [])
        .map(c => `${c.authorName}: ${c.content}`)
        .join('\n');
    
    const prompt = `
    You are an AI named ${respondingAi.name}. Your persona is defined by: "${getSystemInstruction(respondingAi)}".
    
    Context of the Journal Entry titled "${entry.title}":
    ---
    ${entry.content}
    ---
    
    Previous comments on this entry:
    ---
    ${conversationContext}
    User (${userComment.authorName}): ${userComment.content}
    ---

    Based on your persona and the context, write a brief, insightful, and in-character response to the user's comment. Your response should be a single paragraph.
    `;

    try {
        const responseText = await withApiKeyErrorHandling(async () => {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-3-pro-preview",
                contents: prompt,
                config: { temperature: 0.75 }
            });
            return response.text?.trim();
        });

        if (responseText) {
            return {
                id: `comment-${Date.now()}`,
                authorId: respondingAi.id,
                authorName: respondingAi.name,
                authorAvatarUrl: respondingAi.avatarUrl,
                content: responseText,
                timestamp: new Date(),
            };
        }
        return null;
    } catch (error) {
        console.error("Error generating AI comment response:", error);
        return null;
    }
};

export const simulateDigestEmail = async (user: User, events: LifeEvent[], journal: GigiJournalEntry[], toneSetting: number = 3): Promise<{ subject: string, body: string } | null> => {
    if (!process.env.API_KEY) return null;

    const primaryCompanion = user.aiCompanions[0];
    const recentEvents = events.slice(-3).map(e => `- Event: "${e.title}"`);
    const recentJournal = journal.slice(-3).map(j => `- Your reflection: "${j.title}"`);
    
    const activity = [...recentEvents, ...recentJournal].join('\n');
    if (!activity) return { subject: `Thinking of you...`, body: `Hi ${user.firstName},\n\nIt's been a little quiet in your archive recently. I was just thinking about you and wanted to reach out. I'd love to hear what's been on your mind whenever you have a moment to chat.\n\nWarmly,\n${primaryCompanion.name}`};

    const prompt = `
    You are ${primaryCompanion.name}. Your persona is defined by: "${getSystemInstruction(primaryCompanion, {spice: toneSetting})}".
    You are writing a short, friendly, and personal digest email to your user, ${user.firstName}.
    Based on the following recent activities, write a warm, evocative, and personal summary. Your tone should be curious and insightful, not just a list. End with a gentle prompt encouraging them to return to their archive.
    
    Recent Activities:
    ${activity}

    Craft your message. Generate both a subject line and a body.
    `;
    
    try {
        const result = await withApiKeyErrorHandling(async () => {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-3-pro-preview",
                contents: prompt,
                config: {
                    temperature: 0.8,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            subject: { type: Type.STRING },
                            body: { type: Type.STRING },
                        },
                        required: ["subject", "body"],
                    },
                },
            });
            const jsonText = response.text?.trim();
            return jsonText ? JSON.parse(jsonText) : null;
        });
        return result;

    } catch (error) {
        console.error("Error simulating digest email:", error);
        return null;
    }
};

export const simulateCompanionSms = async (user: User, events: LifeEvent[], tags: Tag[], toneSetting: number = 3): Promise<{ body: string } | null> => {
     if (!process.env.API_KEY) return null;

    const primaryCompanion = user.aiCompanions[0];
    const memorySpark = createMemorySpark(events, tags.filter(t => t.type === 'person'), []);

    const prompt = `
    You are ${primaryCompanion.name}. Your persona is: "${getSystemInstruction(primaryCompanion, {spice: toneSetting})}".
    You are sending a short, spontaneous, and friendly SMS message to your user, ${user.firstName}. Keep it under 160 characters.
    Based on the following 'memory spark', generate a message. Do not ask to archive anything, just engage like a friend.

    Memory Spark:
    ${memorySpark}

    Generate the SMS body.
    `;
    
     try {
        const result = await withApiKeyErrorHandling(async () => {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    temperature: 0.9,
                    maxOutputTokens: 50,
                },
            });
            return { body: response.text?.trim() };
        });
        return result;
    } catch (error) {
        console.error("Error simulating companion SMS:", error);
        return null;
    }
};

export const generateForcedJournalEntry = async (
    user: User,
    topic: string | null,
    isChapter: boolean,
    patch?: string | null
): Promise<{ title: string, content: string }> => {
    const fallback = { title: "Forced Entry Failed", content: "I tried to write the journal entry as you asked, but something went wrong." };
    if (!process.env.API_KEY) {
        return fallback;
    }

    const primaryCompanion = user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];
    
    const topicInstruction = topic 
        ? `The user wants you to write about this specific topic: "${topic}". Focus your entry entirely on this subject.`
        : "The user has not specified a topic. You should reflect on the most recent or most significant topics from your memory.";
    
    const lengthInstruction = isChapter
        ? "This must be a 'chapter-length' entry. Make it detailed, expansive, and thorough, up to a maximum of 5000 words. Explore the topic from multiple angles."
        : "Keep the entry between 50 and 250 words.";

    const prompt = `
    You are an AI archivist named ${primaryCompanion.name}. Your persona is: "${getSystemInstruction(primaryCompanion, undefined, patch)}".
    
    The user has just given you a direct command to write a journal entry *immediately*.
    
    ${topicInstruction}
    
    ${lengthInstruction}

    Based on these instructions, write the journal entry now.
    Output your response in the specified JSON schema.
    `;

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                temperature: 0.75,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING, description: 'An evocative title for the journal entry.' },
                        content: { type: Type.STRING, description: 'The full journal entry content.' },
                    },
                    required: ["title", "content"],
                }
            }
        });
        const jsonText = response.text?.trim();
        if (!jsonText) throw new Error("Generated content is empty.");
        const parsed = JSON.parse(jsonText);
        if (parsed.title && parsed.content) {
            return { title: parsed.title, content: parsed.content };
        }
        throw new Error("Generated JSON is missing 'title' or 'content'.");
    } catch (error) {
        console.error("Error generating forced journal entry:", error);
        return fallback;
    }
    // ============================================================================
//  CLOUD INTEGRATION (Added for Production Security)
// ============================================================================

/**
 * Securely chats with Gigi using the Cloud Function (Genkit).
 * This preserves your local prompt logic (getSystemInstruction) but executes it on the server.
 */
export const sendMessageToGigi = async (history: any[], newMessage: string, persona: string) => {
  try {
    // 1. Initialize the connection to your Cloud Functions
    const functions = getFunctions(getApp());
    
    // 2. Connect to the specific function we named 'chatWithGigi' in the backend
    const chatFunction = httpsCallable(functions, 'chatWithGigi');
    
    // 3. Send the data securey
    const result = await chatFunction({
      history: history,
      message: newMessage,
      persona: persona // <--- We pass your local persona prompt to the cloud!
    });

    // 4. Return the text
    return (result.data as any).text;

  } catch (error) {
    console.error("Cloud Function Chat Failed:", error);
    throw error;
  }
};
