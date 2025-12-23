import { Supermemory } from "supermemory";
import type {
  AddMemoryOptions,
  AddMemoryResponse,
  GetMemoryResponse,
  MemorySearchOptions,
  MemorySearchResult,
  MemorySearchResults,
  RelevantDocument,
} from "./types";
import { AddMemoryStatus, MemoryCategory, MemorySource, MemoryManagerError } from "./types";
import type { SearchMemoriesParams } from "supermemory/resources";

/**
 * Configuration options for MemoryManager
 */
export interface MemoryManagerConfig {
  apiKey: string;
  rerankSearch?: boolean;
  searchMode?: "memories" | "hybrid";
  rewriteQuery?: boolean;
  includeDocuments?: boolean;
  includeSummaries?: boolean;
  includeRelatedMemories?: boolean;
  includeForgottenMemories?: boolean;
  includeChunks?: boolean;
}

/**
 * Wrapper around Supermemory SDK with multi-tenancy and metadata support
 *
 * Features:
 * - Multi-tenant storage using containerTag
 * - Metadata-based categorization
 * - CRUD operations for memories
 * - Filtered search by category
 */
export class MemoryManager {
  private client: Supermemory;
  private config: Required<MemoryManagerConfig>;

  constructor(config: MemoryManagerConfig) {
    if (!config.apiKey) {
      throw new MemoryManagerError("API key is required");
    }

    this.client = new Supermemory({ apiKey: config.apiKey });

    // Set defaults
    this.config = {
      apiKey: config.apiKey,
      rerankSearch: config.rerankSearch ?? false,
      searchMode: config.searchMode ?? "memories",
      rewriteQuery: config.rewriteQuery ?? false,
      includeDocuments: config.includeDocuments ?? false,
      includeSummaries: config.includeSummaries ?? false,
      includeRelatedMemories: config.includeRelatedMemories ?? false,
      includeForgottenMemories: config.includeForgottenMemories ?? false,
      includeChunks: config.includeChunks ?? true,
    };
  }

  /**
   * Add a new memory to Supermemory
   *
   * @param options - Memory content and metadata
   * @returns Promise with memory ID and status
   *
   * @example
   * ```typescript
   * const response = await manager.addMemory({
   *   content: "My name is John Doe",
   *   userId: "user123",
   *   category: MemoryCategory.CORE_IDENTITY,
   *   source: MemorySource.USER_CHAT,
   * });
   * ```
   */
  async addMemory(options: AddMemoryOptions): Promise<AddMemoryResponse> {
    try {
      const { content, userId, category, source = MemorySource.USER_CHAT, customId } = options;

      const response = await this.client.add({
        content,
        containerTag: userId,
        customId: customId || crypto.randomUUID(),
        metadata: {
          category: category,
          source: source,
        }
      });

      return {
        id: response.id,
        status: response.status as AddMemoryStatus,
        userId,
        category,
        source,
        customId: customId || undefined,
      };
    } catch (error) {
      throw new MemoryManagerError(`Failed to add memory: ${error instanceof Error ? error.message : String(error)}`, error);
    }
  }

  /**
   * Get a memory by ID
   *
   * @param id - Memory ID
   * @returns Promise with memory details
   */
  async getMemory(id: string): Promise<GetMemoryResponse> {
    try {
      const response = await this.client.memories.get(id);

      if (response.containerTags && response.containerTags.length > 1) {
        console.warn(`Multiple container tags found for memory ${response.id}. Expected only 'userId'.`);
      }

      const userId = response.containerTags?.[0] || "";

      let category, source;
      if (typeof response.metadata === 'object' && response.metadata !== null) {
        category = (response.metadata as any).category;
        source = (response.metadata as any).source;
      }

      return {
        id: response.id,
        status: response.status as AddMemoryStatus,
        userId,
        category: category,
        source: source,
        customId: response.customId || undefined,
        rawContent: response.raw,
        content: response.content,
        title: response.title,
        summary: response.summary,
        type: response.type,
      };
    } catch (error) {
      throw new MemoryManagerError(`Failed to get memory: ${error instanceof Error ? error.message : String(error)}`, error);
    }
  }

  /**
   * Search memories with optional category filtering
   *
   * @param options - Search query and filters
   * @returns Promise with search results
   *
   * @example
   * ```typescript
   * const results = await manager.searchMemory({
   *   query: "What is my favorite movie?",
   *   userId: "user123",
   *   category: MemoryCategory.PREFERENCES,
   *   limit: 10,
   * });
   * ```
   */
  async searchMemory(options: MemorySearchOptions): Promise<MemorySearchResults> {
    try {
      const {
        query,
        userId,
        category,
        source,
        mustMatchBoth = false,
        memorySensitivity = 0.5,
        limit = 10,
      } = options;

      const searchParams: SearchMemoriesParams = {
        q: query,
        containerTag: userId,
        threshold: memorySensitivity,
        // filters: {
        //   OR: [],
        //   AND: []
        // },
        include: {
          documents: this.config.includeDocuments,
          summaries: this.config.includeSummaries,
          relatedMemories: this.config.includeRelatedMemories,
          forgottenMemories: this.config.includeForgottenMemories,
          chunks: this.config.includeChunks,
        },
        limit,
        rerank: this.config.rerankSearch,
        rewriteQuery: this.config.rewriteQuery,
        searchMode: this.config.searchMode,
      };

      // const filters: SearchMemoriesParams.And

      // if (category) {
      //   (filters[filterKey] as unknown[]).push({
      //     filterType: "metadata",
      //     key: "category",
      //     value: category,
      //     ignoreCase: true,
      //     numericOperator: "=",
      //   });
      // }

      // if (source) {
      //   (filters[filterKey] as unknown[]).push({
      //     filterType: "metadata",
      //     key: "source",
      //     value: source,
      //     ignoreCase: true,
      //     numericOperator: "=",
      //   });
      // }

      // if ((filters[filterKey] as unknown[]).length > 0) {
      //   searchParams.filters = filters;
      // }

      const response = await this.client.search.memories(searchParams);

      // Parse results
      const results: MemorySearchResult[] = [];
      const memories = response.results || [];

      for (const memory of memories) {
        const content = memory.memory || memory.chunk || undefined;

        results.push({
          memoryId: memory.id,
          content,
          memoryVersion: memory.version,
          similarityScore: memory.similarity,
          memoryCategory: memory.metadata?.category as MemoryCategory | undefined,
          memorySource: memory.metadata?.source as MemorySource | undefined,
          relevantDocuments:
            memory.documents?.map(
              (doc): RelevantDocument => ({
                id: doc.id,
                title: doc.title,
                summary: doc.summary,
                type: doc.type,
                category: doc.metadata?.category as string | undefined,
                source: doc.metadata?.source as string | undefined,
              })
            ) || [],
          lastUpdatedAt: memory.updatedAt,
        });
      }

      return {
        count: response.total || 0,
        results,
      };
    } catch (error) {
      throw new MemoryManagerError(`Failed to search memories: ${error instanceof Error ? error.message : String(error)}`, error);
    }
  }

  /**
   * Update an existing document with new content
   *
   * @param documentId - Document ID
   * @param userId - User ID
   * @param content - New content
   * @param customId - Optional custom ID
   * @returns Promise with update response
   */
  async updateDocument(
    documentId: string,
    userId: string,
    content: string,
    customId?: string
  ): Promise<AddMemoryResponse> {
    try {
      const response = await this.client.documents.update(documentId, {
        containerTag: userId,
        content,
        customId,
      });

      return {
        id: response.id,
        status: response.status as AddMemoryStatus,
        userId,
        customId,
      };
    } catch (error) {
      throw new MemoryManagerError(`Failed to update document: ${error instanceof Error ? error.message : String(error)}`, error);
    }
  }

  /**
   * Delete a memory by ID
   *
   * @param memoryId - Memory ID
   * @returns Promise<boolean> - True if successful
   */
  async deleteMemory(memoryId: string): Promise<boolean> {
    try {
      await this.client.memories.delete(memoryId);
      return true;
    } catch (error) {
      console.error(`Failed to delete memory ${memoryId}:`, error);
      return false;
    }
  }

  /**
   * Get all memories for a user with optional category filter
   *
   * @param userId - User ID
   * @param category - Optional category filter
   * @returns Promise with all matching memories
   */
  async getAllMemories(userId: string, category?: MemoryCategory): Promise<MemorySearchResults> {
    return this.searchMemory({
      query: "",
      userId,
      category,
      limit: 100,
    });
  }

  /**
   * Bulk delete documents by IDs
   *
   * @param userId - User ID
   * @param docIds - Array of document IDs to delete
   * @returns Promise with bulk delete results
   */
  async bulkDeleteDocuments(userId: string, docIds: string[]): Promise<{
    success: boolean;
    totalCount: number;
    successCount: number;
    errorCount: number;
    errors: Array<{ id: string; error: string }>;
  }> {
    try {
      const response = await this.client.documents.deleteBulk({
        ids: docIds,
        containerTags: [userId],
      });

      return {
        success: response.success || false,
        totalCount: (response.deletedCount || 0) + (response.errors?.length || 0),
        successCount: response.deletedCount || 0,
        errorCount: response.errors?.length || 0,
        errors:
          response.errors?.map((err) => ({
            id: err.id,
            error: err.error,
          })) || [],
      };
    } catch (error) {
      throw new MemoryManagerError(`Failed to bulk delete documents: ${error instanceof Error ? error.message : String(error)}`, error);
    }
  }
}
