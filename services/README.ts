/**
 * Data and YouTube Extraction Services Placeholder for Sonance
 * Extraction logic and API integrations will be implemented here in future sprints.
 */

export interface ExtractionService {
  extractStreamUrl: (videoId: string) => Promise<string | null>;
}

export const extractionServicePlaceholder: ExtractionService = {
  extractStreamUrl: async (_videoId: string) => null,
};
