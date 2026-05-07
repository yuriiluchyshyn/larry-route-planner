// Utility for searching and scrolling to freight offers in external HTML tables
// Handles pagination and response limits for freight offer search functionality

export interface OfferSearchCriteria {
  offerId?: string;
  companyName?: string;
  loadingCity?: string;
  unloadingCity?: string;
  loadingCountry?: string;
  unloadingCountry?: string;
  priceRange?: {
    min: number;
    max: number;
    currency?: string;
  };
  dateRange?: {
    from: string;
    to: string;
  };
  capacity?: {
    min: number;
    max: number;
  };
}

export interface SearchResult {
  found: boolean;
  element?: HTMLElement;
  rowIndex?: number;
  pageNumber?: number;
  error?: string;
  requiresPagination?: boolean;
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  pageSize: number;
}

export class OfferSearcher {
  private document: Document;
  private tableSelector = '.table-responsive table, .offers-table, table[class*="offer"], table[class*="freight"]';
  private rowSelector = 'tbody tr, tr[class*="offer"], tr[data-offer-id]';
  private paginationSelector = '.pagination, .pager, [class*="pagination"], [class*="pager"]';
  
  constructor(document: Document = window.document) {
    this.document = document;
  }

  /**
   * Search for a freight offer in the current page
   */
  searchInCurrentPage(criteria: OfferSearchCriteria): SearchResult {
    try {
      const tables = this.document.querySelectorAll(this.tableSelector);
      
      if (tables.length === 0) {
        return {
          found: false,
          error: 'No freight offer tables found on the page'
        };
      }

      for (const table of tables) {
        const rows = table.querySelectorAll(this.rowSelector);
        
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i] as HTMLElement;
          
          if (this.matchesRow(row, criteria)) {
            return {
              found: true,
              element: row,
              rowIndex: i
            };
          }
        }
      }

      return {
        found: false,
        error: 'Offer not found in current page',
        requiresPagination: this.hasPagination()
      };
    } catch (error) {
      return {
        found: false,
        error: `Search error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Search across multiple pages with pagination
   */
  async searchWithPagination(
    criteria: OfferSearchCriteria,
    maxPages: number = 10,
    onPageChange?: (page: number) => void
  ): Promise<SearchResult> {
    const paginationInfo = this.getPaginationInfo();
    
    if (!paginationInfo) {
      // No pagination, search only current page
      return this.searchInCurrentPage(criteria);
    }

    let currentPage = paginationInfo.currentPage;
    const startPage = currentPage;

    // Search current page first
    let result = this.searchInCurrentPage(criteria);
    if (result.found) {
      return { ...result, pageNumber: currentPage };
    }

    // Search next pages
    for (let page = currentPage + 1; page <= Math.min(paginationInfo.totalPages, startPage + maxPages); page++) {
      if (await this.navigateToPage(page)) {
        onPageChange?.(page);
        
        // Wait for page to load
        await this.waitForPageLoad();
        
        result = this.searchInCurrentPage(criteria);
        if (result.found) {
          return { ...result, pageNumber: page };
        }
      }
    }

    // Search previous pages if not found
    for (let page = startPage - 1; page >= Math.max(1, startPage - maxPages); page--) {
      if (await this.navigateToPage(page)) {
        onPageChange?.(page);
        
        await this.waitForPageLoad();
        
        result = this.searchInCurrentPage(criteria);
        if (result.found) {
          return { ...result, pageNumber: page };
        }
      }
    }

    // Return to original page if not found
    await this.navigateToPage(startPage);
    
    return {
      found: false,
      error: `Offer not found in ${maxPages * 2} pages searched`,
      requiresPagination: true
    };
  }

  /**
   * Scroll to and highlight a found element
   */
  scrollToElement(element: HTMLElement, highlight: boolean = true): void {
    // Scroll element into view
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    });

    if (highlight) {
      // Add highlight class
      element.classList.add('larry-highlight');
      
      // Remove highlight after 3 seconds
      setTimeout(() => {
        element.classList.remove('larry-highlight');
      }, 3000);
    }

    // Trigger click if it's a clickable row
    if (element.tagName.toLowerCase() === 'tr' || element.classList.contains('clickable-row')) {
      element.click();
    }
  }

  /**
   * Check if row matches search criteria
   */
  private matchesRow(row: HTMLElement, criteria: OfferSearchCriteria): boolean {
    const rowText = row.textContent?.toLowerCase() || '';
    
    // Check offer ID (most specific)
    if (criteria.offerId) {
      const offerIdAttr = row.getAttribute('data-offer-id') || 
                         row.getAttribute('id') ||
                         row.querySelector('[data-offer-id]')?.getAttribute('data-offer-id');
      
      if (offerIdAttr && offerIdAttr.includes(criteria.offerId)) {
        return true;
      }
      
      // Also check if ID appears in text content
      if (rowText.includes(criteria.offerId.toLowerCase())) {
        return true;
      }
    }

    // Check company name
    if (criteria.companyName) {
      const companyName = criteria.companyName.toLowerCase();
      if (rowText.includes(companyName)) {
        return true;
      }
    }

    // Check loading city
    if (criteria.loadingCity) {
      const loadingCity = criteria.loadingCity.toLowerCase();
      if (rowText.includes(loadingCity)) {
        // Additional check: make sure it's in a loading-related column
        const loadingColumns = this.findColumnsByHeader(row, ['loading', 'from', 'pickup', 'origin']);
        if (loadingColumns.some(col => col.textContent?.toLowerCase().includes(loadingCity))) {
          return true;
        }
      }
    }

    // Check unloading city
    if (criteria.unloadingCity) {
      const unloadingCity = criteria.unloadingCity.toLowerCase();
      if (rowText.includes(unloadingCity)) {
        // Additional check: make sure it's in an unloading-related column
        const unloadingColumns = this.findColumnsByHeader(row, ['unloading', 'to', 'delivery', 'destination']);
        if (unloadingColumns.some(col => col.textContent?.toLowerCase().includes(unloadingCity))) {
          return true;
        }
      }
    }

    // Check price range
    if (criteria.priceRange) {
      const priceText = this.extractPriceFromRow(row);
      if (priceText) {
        const price = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.'));
        if (!isNaN(price) && 
            price >= criteria.priceRange.min && 
            price <= criteria.priceRange.max) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Find columns by header text
   */
  private findColumnsByHeader(row: HTMLElement, headerKeywords: string[]): HTMLElement[] {
    const table = row.closest('table');
    if (!table) return [];

    const headers = table.querySelectorAll('thead th, thead td');
    const matchingColumnIndexes: number[] = [];

    headers.forEach((header, index) => {
      const headerText = header.textContent?.toLowerCase() || '';
      if (headerKeywords.some(keyword => headerText.includes(keyword))) {
        matchingColumnIndexes.push(index);
      }
    });

    const cells = row.querySelectorAll('td, th');
    return matchingColumnIndexes
      .filter(index => index < cells.length)
      .map(index => cells[index] as HTMLElement);
  }

  /**
   * Extract price from row
   */
  private extractPriceFromRow(row: HTMLElement): string | null {
    const priceColumns = this.findColumnsByHeader(row, ['price', 'cost', 'rate', 'eur', '€', '$']);
    
    for (const column of priceColumns) {
      const text = column.textContent || '';
      const priceMatch = text.match(/[\d.,]+/);
      if (priceMatch) {
        return priceMatch[0];
      }
    }

    return null;
  }

  /**
   * Check if page has pagination
   */
  private hasPagination(): boolean {
    return this.document.querySelector(this.paginationSelector) !== null;
  }

  /**
   * Get pagination information
   */
  private getPaginationInfo(): PaginationInfo | null {
    const paginationElement = this.document.querySelector(this.paginationSelector);
    if (!paginationElement) return null;

    try {
      // Try to find current page indicator
      const currentPageElement = paginationElement.querySelector('.active, .current, [aria-current="page"]') ||
                                paginationElement.querySelector('span:not([class*="next"]):not([class*="prev"])');
      
      const currentPage = currentPageElement ? 
        parseInt(currentPageElement.textContent || '1') : 1;

      // Try to find total pages
      const pageLinks = paginationElement.querySelectorAll('a, button, span');
      let totalPages = 1;
      
      pageLinks.forEach(link => {
        const text = link.textContent || '';
        const pageNum = parseInt(text);
        if (!isNaN(pageNum) && pageNum > totalPages) {
          totalPages = pageNum;
        }
      });

      // Check for next/previous buttons
      const hasNext = paginationElement.querySelector('[class*="next"]:not(.disabled), [aria-label*="next"]:not(.disabled)') !== null;
      const hasPrevious = paginationElement.querySelector('[class*="prev"]:not(.disabled), [aria-label*="prev"]:not(.disabled)') !== null;

      return {
        currentPage,
        totalPages,
        hasNext,
        hasPrevious,
        pageSize: 20 // Default assumption
      };
    } catch (error) {
      console.warn('Failed to parse pagination info:', error);
      return null;
    }
  }

  /**
   * Navigate to specific page
   */
  private async navigateToPage(pageNumber: number): Promise<boolean> {
    const paginationElement = this.document.querySelector(this.paginationSelector);
    if (!paginationElement) return false;

    try {
      // Look for direct page link
      const pageLink = paginationElement.querySelector(`a[href*="${pageNumber}"], button[data-page="${pageNumber}"]`) as HTMLElement;
      
      if (pageLink) {
        pageLink.click();
        return true;
      }

      // Look for page input field
      const pageInput = paginationElement.querySelector('input[type="number"], input[name*="page"]') as HTMLInputElement;
      if (pageInput) {
        pageInput.value = pageNumber.toString();
        
        // Trigger change event
        pageInput.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Look for submit button
        const submitButton = paginationElement.querySelector('button[type="submit"], .go-button') as HTMLElement;
        if (submitButton) {
          submitButton.click();
          return true;
        }
      }

      return false;
    } catch (error) {
      console.warn('Failed to navigate to page:', error);
      return false;
    }
  }

  /**
   * Wait for page to load after navigation
   */
  private async waitForPageLoad(timeout: number = 5000): Promise<void> {
    return new Promise((resolve) => {
      let timeoutId: number;
      
      const checkLoading = () => {
        // Check for loading indicators
        const loadingElements = this.document.querySelectorAll('.loading, .spinner, [class*="load"]');
        const hasLoading = Array.from(loadingElements).some(el => 
          getComputedStyle(el).display !== 'none'
        );

        if (!hasLoading) {
          clearTimeout(timeoutId);
          resolve();
        }
      };

      // Check immediately
      checkLoading();

      // Set up timeout
      timeoutId = window.setTimeout(() => {
        resolve();
      }, timeout);

      // Check periodically
      const interval = setInterval(() => {
        checkLoading();
        if (timeoutId === undefined) {
          clearInterval(interval);
        }
      }, 100);
    });
  }
}

// CSS for highlighting found elements
export const highlightStyles = `
  .larry-highlight {
    background-color: #ffeb3b !important;
    border: 2px solid #ff9800 !important;
    box-shadow: 0 0 10px rgba(255, 152, 0, 0.5) !important;
    transition: all 0.3s ease !important;
  }
  
  .larry-highlight td {
    background-color: inherit !important;
  }
`;

// Inject highlight styles into document
export function injectHighlightStyles(document: Document = window.document): void {
  const styleId = 'larry-highlight-styles';
  
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = highlightStyles;
    document.head.appendChild(style);
  }
}