/**
 * Extension Messaging Hook
 * Хук для роботи з повідомленнями extension
 */

import { useEffect, useCallback } from 'react';
import { 
  requestTokenFromExtension, 
  requestFiltersFromExtension, 
  processFiltersFromExtension,
  isInExtensionContext
} from '../services/extensionService';
import { sendTokenToProxy } from '../services/tokenService';
import type { RouteConfig } from '../types';

interface UseExtensionMessagingProps {
  config: RouteConfig | null;
  onConfigChange: (config: RouteConfig) => void;
  onTokenReceived: (token: string) => void;
  onSearchStatusChange: (status: string | null) => void;
  onExtensionVehicleTypesReceived?: (types: string[]) => void;
}

export function useExtensionMessaging({
  config,
  onConfigChange,
  onTokenReceived,
  onSearchStatusChange,
  onExtensionVehicleTypesReceived
}: UseExtensionMessagingProps) {
  
  // Initialize extension messaging
  useEffect(() => {
    console.log('Larry: Extension messaging ready');
    
    // Send initial token to proxy if available
    if (config?.bearerToken) {
      sendTokenToProxy(config.bearerToken);
    }
  }, [config?.bearerToken]);

  // Request token and filters from extension if not found
  useEffect(() => {
    if (isInExtensionContext()) {
      // Only request token if we don't have one
      if (!config?.bearerToken) {
        console.log('Larry: No token in config, requesting from extension');
        requestTokenFromExtension();
      } else {
        console.log('Larry: Token already available in config, skipping request');
      }
      
      // Always request fresh filters from the page
      requestFiltersFromExtension();
    }
  }, [config?.bearerToken]);

  // Handle messages from extension
  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data.type === 'TOKEN_RESPONSE' && event.data.token) {
      console.log('Larry: Received token from extension');
      console.log('Larry: Token length:', event.data.token.length);
      console.log('Larry: Token starts with:', event.data.token.substring(0, 20) + '...');
      
      onTokenReceived(event.data.token);
      // Send token to proxy server
      sendTokenToProxy(event.data.token);
    }
    
    if (event.data.type === 'FILTERS_RESPONSE' && event.data.filters) {
      console.log('Larry: Received filters from extension:', event.data.filters);
      
      // Зберігаємо оригінальні типи вантажівок з extension
      if (event.data.filters.vehicleTypes && Array.isArray(event.data.filters.vehicleTypes)) {
        onExtensionVehicleTypesReceived?.(event.data.filters.vehicleTypes);
      }
      
      const newConfig = processFiltersFromExtension(event.data.filters, config);
      onConfigChange(newConfig);
    }
    
    if (event.data.type === 'OFFER_SEARCH_RESULT') {
      const { found, offerId, error, searchTime, pageNumber } = event.data;
      
      if (found) {
        const message = pageNumber 
          ? `✅ Знайдено пропозицію ${offerId} на сторінці ${pageNumber} (${searchTime}ms)`
          : `✅ Знайдено пропозицію ${offerId} (${searchTime}ms)`;
        
        onSearchStatusChange(message);
        console.log(`Larry: Successfully found and clicked offer ${offerId}`);
      } else {
        const message = `❌ Не вдалося знайти пропозицію ${offerId}: ${error}`;
        onSearchStatusChange(message);
        console.warn(`Larry: Could not find offer ${offerId}`, error);
      }
      
      // Clear status after 5 seconds
      setTimeout(() => onSearchStatusChange(null), 5000);
    }
  }, [config, onConfigChange, onTokenReceived, onSearchStatusChange, onExtensionVehicleTypesReceived]);

  // Listen for messages from extension
  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);
}