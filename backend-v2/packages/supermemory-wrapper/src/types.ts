/**
 * Memory category types for organizing memories
 */
export enum MemoryCategory {
  CORE_IDENTITY = "core_identity",
  PREFERENCES = "preferences",
  EXTERNAL_DATA = "external_data",
  EPISODIC_MEMORY = "episodic_memory",
  WORK_CONTEXT = "work_context",
  COMMUNICATION = "communication",
}

/**
 * Memory source types for tracking origin
 */
export enum MemorySource {
  USER_CHAT = "user_chat",
  GMAIL = "gmail",
  GOOGLE_CALENDAR = "google_calendar",
  EMAIL_SYNC = "email_sync",
  CALENDAR_SYNC = "calendar_sync",
  SYSTEM = "system",
}

/**
 * Memory status during processing
 */
export enum AddMemoryStatus {
  UNKNOWN = "unknown",
  QUEUED = "queued",
  EXTRACTING = "extracting",
  CHUNKING = "chunking",
  EMBEDDING = "embedding",
  INDEXING = "indexing",
  DONE = "done",
  FAILED = "failed",
}

/**
 * Metadata schema for memory entries
 */
// export interface MemoryMetadata {
//   [key: string]: 
// }

/**
 * Response when adding a memory
 */
export interface AddMemoryResponse {
  id: string;
  status: AddMemoryStatus;
  userId: string;
  category?: MemoryCategory;
  source?: MemorySource;
  customId?: string;
}

/**
 * Response when retrieving a memory
 */
export interface GetMemoryResponse extends AddMemoryResponse {
  rawContent: unknown;
  content: string | null;
  title: string | null;
  summary: string | null;
  type?: string;
}

/**
 * Document associated with a memory
 */
export interface RelevantDocument {
  id: string;
  title?: string;
  summary?: string | null;
  type?: string;
  category?: string;
  source?: string;
}

export interface MemorySearchOptions {
  query: string;
  userId: string;
  category?: MemoryCategory;
  source?: MemorySource;
  limit?: number;
  mustMatchBoth?: boolean;
  memorySensitivity?: number;
}


/**
 * Single search result
 */
export interface MemorySearchResult {
  memoryId: string;
  content?: string;
  memoryVersion?: number | null;
  similarityScore: number;
  memoryCategory?: MemoryCategory;
  memorySource?: MemorySource;
  relevantDocuments: RelevantDocument[];
  lastUpdatedAt?: string;
}

/**
 * Search results container
 */
export interface MemorySearchResults {
  count: number;
  results: MemorySearchResult[];
}

/**
 * Options for adding a memory
 */
export interface AddMemoryOptions {
  content: string;
  userId: string;
  category: MemoryCategory;
  source?: MemorySource;
  customId?: string;
}

/**
 * Options for searching memories
 */
export interface SearchMemoryOptions {
  query: string;
  userId: string;
  category?: MemoryCategory;
  source?: MemorySource;
  mustMatchBoth?: boolean;
  memorySensitivity?: number;
  limit?: number;
}

/**
 * Error thrown by MemoryManager
 */
export class MemoryManagerError extends Error {
  constructor(message: string, public override cause?: unknown) {
    super(message);
    this.name = "MemoryManagerError";
  }
}
