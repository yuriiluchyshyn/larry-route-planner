// Enhanced messaging system for communication with browser extension
// Handles offer search, pagination, and scroll functionality

import { OfferSearcher, type OfferSearchCriteria, injectHighlightStyles } from './offerSearcher';

export interface ExtensionMessage {
  type: string;
  [key: string]: any;
}

export interface OfferSearchRequest {
  type: 'FIND_AND_CLICK_OFFER';
  offerId: string;
  companyName?: string;
  loadingCity?: string;
  unloadingCity?: string;
  loadingCountry?: string;
  unloadingCountry?: string;
  scrollToElement?: boolean;
  highlightElement?: boolean;
  maxPagesToSearch?: number;
}

export interface OfferSearchResponse {
  type: 'OFFER_SEARCH_RESULT';
  found: boolean;
  offerId: string;
  rowIndex?: number;
  pageNumber?: number;
  error?: string;
  searchTime?: number;
}

export class ExtensionMessaging {
  private searcher: OfferSearcher;
  private messageHandlers: Map<string, (data: any) => void | Promise<void>>;

  constructor() {
    this.searcher = new OfferSearcher();
    this.messageHandlers = new Map();
    this.setupMessageHandlers();
    this.startListening();
    
    // Inject highlight styles
    injectHighlightStyles();
  }

  private setupMessageHandlers(): void {
    // Handle offer search requests
    this.messageHandlers.set('FIND_AND_CLICK_OFFER', this.handleOfferSearch.bind(this));
    
    // Handle token requests
    this.messageHandlers.set('REQUEST_TOKEN', this.handleTokenRequest.bind(this));
    
    // Handle filter requests
    this.messageHandlers.set('REQUEST_FILTERS', this.handleFiltersRequest.bind(this));
    
    // Handle pagination info requests
    this.messageHandlers.set('REQUEST_PAGINATION_INFO', this.handlePaginationInfoRequest.bind(this));
  }

  private startListening(): void {
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type) {
        const handler = this.messageHandlers.get(event.data.type);
        if (handler) {
          handler(event.data);
        }
      }
    });
  }

  /**
   * Handle offer search requests from the Larry app
   */
  private async handleOfferSearch(data: OfferSearchRequest): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('Extension: Searching for offer:', data);
      
      const criteria: OfferSearchCriteria = {
        offerId: data.offerId,
        companyName: data.companyName,
        loadingCity: data.loadingCity,
        unloadingCity: data.unloadingCity,
        loadingCountry: data.loadingCountry,
        unloadingCountry: data.unloadingCountry
      };

      const maxPages = data.maxPagesToSearch || 5;
      
      // Search with pagination support
      const result = await this.searcher.searchWithPagination(
        criteria,
        maxPages,
        (page) => {
          console.log(`Extension: Searching page ${page}...`);
        }
      );

      if (result.found && result.element) {
        console.log('Extension: Offer found!', result);
        
        // Scroll to element if requested
        if (data.scrollToElement !== false) {
          this.searcher.scrollToElement(
            result.element, 
            data.highlightElement !== false
          );
        }

        // Send success response
        this.sendResponse({
          type: 'OFFER_SEARCH_RESULT',
          found: true,
          offerId: data.offerId,
          rowIndex: result.rowIndex,
          pageNumber: result.pageNumber,
          searchTime: Date.now() - startTime
        });
      } else {
        console.warn('Extension: Offer not found:', result.error);
        
        // Send failure response
        this.sendResponse({
          type: 'OFFER_SEARCH_RESULT',
          found: false,
          offerId: data.offerId,
          error: result.error,
          searchTime: Date.now() - startTime
        });
      }
    } catch (error) {
      console.error('Extension: Search error:', error);
      
      this.sendResponse({
        type: 'OFFER_SEARCH_RESULT',
        found: false,
        offerId: data.offerId,
        error: error instanceof Error ? error.message : 'Unknown search error',
        searchTime: Date.now() - startTime
      });
    }
  }

  /**
   * Handle token requests from Larry app
   */
  private handleTokenRequest(): void {
    try {
      // Try to extract token from various sources
      let token = '';
      
      // Check localStorage
      const localToken = localStorage.getItem('transFrameToken') || 
                        localStorage.getItem('authToken') ||
                        localStorage.getItem('bearerToken');
      
      if (localToken) {
        token = localToken;
      } else {
        // Try to extract from page headers or meta tags
        const metaToken = document.querySelector('meta[name="csrf-token"], meta[name="auth-token"]');
        if (metaToken) {
          token = metaToken.getAttribute('content') || '';
        }
      }

      console.log('Extension: Sending token response:', token ? 'Token found' : 'No token');
      
      this.sendResponse({
        type: 'TOKEN_RESPONSE',
        token: token
      });
    } catch (error) {
      console.error('Extension: Token extraction error:', error);
      this.sendResponse({
        type: 'TOKEN_RESPONSE',
        token: '',
        error: error instanceof Error ? error.message : 'Token extraction failed'
      });
    }
  }

  /**
   * Handle filter requests from Larry app
   */
  private handleFiltersRequest(): void {
    try {
      const filters = this.extractFiltersFromPage();
      
      console.log('Extension: Sending filters response:', filters);
      
      this.sendResponse({
        type: 'FILTERS_RESPONSE',
        filters: filters
      });
    } catch (error) {
      console.error('Extension: Filter extraction error:', error);
      this.sendResponse({
        type: 'FILTERS_RESPONSE',
        filters: null,
        error: error instanceof Error ? error.message : 'Filter extraction failed'
      });
    }
  }

  /**
   * Handle pagination info requests
   */
  private handlePaginationInfoRequest(): void {
    try {
      const paginationInfo = this.searcher['getPaginationInfo']();
      
      this.sendResponse({
        type: 'PAGINATION_INFO_RESPONSE',
        paginationInfo: paginationInfo
      });
    } catch (error) {
      console.error('Extension: Pagination info error:', error);
      this.sendResponse({
        type: 'PAGINATION_INFO_RESPONSE',
        paginationInfo: null,
        error: error instanceof Error ? error.message : 'Pagination info extraction failed'
      });
    }
  }

  /**
   * Extract filters from the current page
   */
  private extractFiltersFromPage(): any {
    const filters: any = {
      loadingPoints: [],
      unloadingPoints: [],
      minWeight: null,
      maxWeight: null,
      dateRange: null
    };

    try {
      // Try to extract from form inputs
      const loadingInputs = document.querySelectorAll('input[name*="loading"], input[placeholder*="loading"], input[id*="loading"]');
      const unloadingInputs = document.querySelectorAll('input[name*="unloading"], input[placeholder*="unloading"], input[id*="unloading"]');
      
      // Extract loading points
      loadingInputs.forEach((input, index) => {
        const value = (input as HTMLInputElement).value;
        if (value) {
          filters.loadingPoints.push({
            id: `lp${index + 1}`,
            locality: value,
            postalCode: '',
            country: '47_poland', // Default
            range: 50
          });
        }
      });

      // Extract unloading points
      unloadingInputs.forEach((input, index) => {
        const value = (input as HTMLInputElement).value;
        if (value) {
          filters.unloadingPoints.push({
            id: `up${index + 1}`,
            locality: value,
            postalCode: '',
            country: '21_germany', // Default
            range: 50
          });
        }
      });

      // Extract weight filters
      const weightInputs = document.querySelectorAll('input[name*="weight"], input[placeholder*="weight"], input[id*="weight"]');
      weightInputs.forEach(input => {
        const value = parseFloat((input as HTMLInputElement).value);
        if (!isNaN(value)) {
          if (input.getAttribute('name')?.includes('min') || input.getAttribute('placeholder')?.includes('min')) {
            filters.minWeight = value;
          } else if (input.getAttribute('name')?.includes('max') || input.getAttribute('placeholder')?.includes('max')) {
            filters.maxWeight = value;
          } else {
            filters.minWeight = value; // Default to min weight
          }
        }
      });

      // Extract date filters
      const dateInputs = document.querySelectorAll('input[type="date"], input[name*="date"], input[placeholder*="date"]');
      if (dateInputs.length >= 2) {
        const fromDate = (dateInputs[0] as HTMLInputElement).value;
        const toDate = (dateInputs[1] as HTMLInputElement).value;
        
        if (fromDate && toDate) {
          filters.dateRange = {
            from: fromDate,
            to: toDate
          };
        }
      }

    } catch (error) {
      console.warn('Extension: Error extracting filters:', error);
    }

    return filters;
  }

  /**
   * Send response back to Larry app
   */
  private sendResponse(data: any): void {
    // Send to parent window (if in iframe)
    if (window.parent !== window) {
      window.parent.postMessage(data, '*');
    }
    
    // Also send to any child frames
    Array.from(window.frames).forEach(frame => {
      try {
        frame.postMessage(data, '*');
      } catch (error) {
        // Ignore cross-origin errors
      }
    });
  }

  /**
   * Send message to Larry app
   */
  public sendMessage(data: ExtensionMessage): void {
    this.sendResponse(data);
  }

  /**
   * Search for offer manually (for testing)
   */
  public async searchOffer(criteria: OfferSearchCriteria, maxPages: number = 5): Promise<any> {
    return await this.searcher.searchWithPagination(criteria, maxPages);
  }
}

// Create global instance for extension use
declare global {
  interface Window {
    larryExtensionMessaging?: ExtensionMessaging;
  }
}

// Initialize extension messaging if not already done
if (typeof window !== 'undefined' && !window.larryExtensionMessaging) {
  window.larryExtensionMessaging = new ExtensionMessaging();
  console.log('Larry Extension Messaging initialized');
}

export default ExtensionMessaging;