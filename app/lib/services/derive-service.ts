/**
 * FOChainData - Derive Protocol WebSocket API Integration
 * 
 * This service handles fetching option chain data from the Derive protocol
 * using their WebSocket API. It provides methods to fetch all instruments
 * and detailed instrument data for options trading.
 */

interface DeriveWebSocketMessage {
  jsonrpc: string;
  id: number;
  method: string;
  params: Record<string, any>;
}

interface DeriveSubscription {
  channel: string;
  instrumentName?: string;
  currency?: string;
  callback: (data: any) => void;
  intervalId?: NodeJS.Timeout;
}

interface DeriveInstrument {
  instrument_name: string;
  base_currency: string;
  quote_currency: string;
  settlement_currency: string;
  option_type?: string; // "call" or "put"
  strike?: number;
  expiration_timestamp: number;
  creation_timestamp: number;
  instrument_id: number;
}

interface DeriveInstrumentDetails {
  instrument_name: string;
  tick_size: number;
  taker_commission: number;
  maker_commission: number;
  min_trade_amount: number;
  contract_size: number;
  block_trade_commission: number;
  block_trade_min_trade_amount: number;
  option_type?: string;
  strike?: number;
  settlement_period: string;
  quote_currency: string;
  base_currency: string;
  settlement_currency: string;
  is_active: boolean;
  expiration_timestamp: number;
  creation_timestamp: number;
  price_index: string;
  kind: string;
}

interface DeriveOptionChain {
  expiryDate: string;
  expiryTimestamp: number;
  instrumentId: number;
  instrumentName: string;
  options: {
    calls: DeriveOptionData[];
    puts: DeriveOptionData[];
  };
}

interface DeriveOptionData {
  strike: number;
  instrumentName: string;
  delta?: number;
  iv?: number;
  volume?: number;
  bidSize?: number;
  bidPrice?: number;
  askPrice?: number;
  askSize?: number;
  optionType: 'call' | 'put';
}

class DeriveService {
  private ws: WebSocket | null = null;
  private messageId = 1;
  private pendingRequests: Map<number, { resolve: Function, reject: Function }> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private url = 'wss://www.derive.xyz/ws/api/v2/';
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private sessionKey: string | null = null;
  private subscriptions: Map<string, DeriveSubscription> = new Map();
  private subscriptionId = 1;

  /**
   * Initialize WebSocket connection to Derive API
   */
  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        console.log('WebSocket already connected');
        resolve();
        return;
      }

      console.log(`Connecting to WebSocket at ${this.url}...`);
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('WebSocket connection established successfully');
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onmessage = (event) => {
        console.log('Received WebSocket message:', event.data);
        const response = JSON.parse(event.data);
        
        // Handle subscription updates
        if (response.method === 'subscription') {
          const { channel, data } = response.params;
          console.log(`Received update for channel: ${channel}`, data);
          
          // Find and call the appropriate subscription callback
          for (const [id, subscription] of Array.from(this.subscriptions.entries())) {
            if (subscription.channel === channel) {
              subscription.callback(data);
            }
          }
          return;
        }
        
        // Handle regular request responses
        const requestId = response.id;
        if (this.pendingRequests.has(requestId)) {
          const { resolve } = this.pendingRequests.get(requestId)!;
          this.pendingRequests.delete(requestId);
          
          if (response.error) {
            console.error('API error:', response.error);
            resolve({ error: response.error });
          } else {
            console.log(`Request ${requestId} completed successfully`);
            resolve(response.result);
          }
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => {
            this.connect().catch(console.error);
          }, this.reconnectDelay * this.reconnectAttempts);
        }
      };
    });
  }

  /**
   * Send a message to the WebSocket API
   */
  private async sendMessage<T>(method: string, params: Record<string, any> = {}): Promise<T> {
    await this.connect();

    return new Promise((resolve, reject) => {
      const id = this.messageId++;
      
      const message: DeriveWebSocketMessage = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      console.log(`Sending WebSocket request ${id} - Method: ${method}`, params);
      this.pendingRequests.set(id, { resolve, reject });
      
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
        console.log(`Request ${id} sent successfully`);
      } else {
        console.error('WebSocket is not connected');
        reject(new Error('WebSocket is not connected'));
        this.pendingRequests.delete(id);
      }

      // Set timeout to prevent hanging requests
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          console.error(`Request ${id} timed out`);
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Login to the Derive API
   * @param email User email
   * @param password User password
   */
  async login(email: string, password: string): Promise<boolean> {
    try {
      const response = await this.sendMessage<any>('login', {
        email,
        password
      });
      
      if (response.error) {
        console.error('Login error:', response.error);
        return false;
      }
      
      this.accessToken = response.access_token;
      this.refreshToken = response.refresh_token;
      
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }

  /**
   * Register a session key for API access
   */
  async registerSessionKey(): Promise<boolean> {
    if (!this.accessToken) {
      console.error('Not logged in');
      return false;
    }
    
    try {
      // First, build the transaction
      const buildResponse = await this.sendMessage<any>('build_register_session_key_tx', {
        access_token: this.accessToken
      });
      
      if (buildResponse.error) {
        console.error('Build session key error:', buildResponse.error);
        return false;
      }
      
      // Then register the session key
      const registerResponse = await this.sendMessage<any>('register_session_key', {
        access_token: this.accessToken,
        tx: buildResponse.tx,
        signature: buildResponse.signature // In a real implementation, you'd sign this
      });
      
      if (registerResponse.error) {
        console.error('Register session key error:', registerResponse.error);
        return false;
      }
      
      this.sessionKey = registerResponse.session_key;
      return true;
    } catch (error) {
      console.error('Register session key error:', error);
      return false;
    }
  }

  /**
   * Get all available currencies
   */
  async getAllCurrencies(): Promise<any[]> {
    try {
      console.log('Fetching all currencies...');
      // For Derive API, we'll use a hardcoded list of supported currencies
      // since the API doesn't have a direct endpoint for this
      const supportedCurrencies = [
        { currency: 'BTC', name: 'Bitcoin' },
        { currency: 'ETH', name: 'Ethereum' }
      ];
      
      console.log('Available currencies:', supportedCurrencies);
      return supportedCurrencies;
    } catch (error) {
      console.error('Error fetching currencies:', error);
      return [];
    }
  }

  /**
   * Get currency details
   * @param currency The currency code (e.g., "ETH", "BTC")
   */
  async getCurrency(currency: string): Promise<any> {
    try {
      console.log(`Checking if currency ${currency} is supported...`);
      
      // Check against our hardcoded list of supported currencies
      const supportedCurrencies = await this.getAllCurrencies();
      const currencyInfo = supportedCurrencies.find(c => c.currency === currency);
      
      if (!currencyInfo) {
        console.log(`Currency ${currency} is not supported`);
        return null;
      }
      
      console.log(`Currency ${currency} is supported:`, currencyInfo);
      return currencyInfo;
    } catch (error) {
      console.error(`Error checking currency ${currency}:`, error);
      return null;
    }
  }

  /**
   * Fetch all available instruments for a specific currency
   * @param currency The currency to filter instruments by (e.g., "ETH", "BTC")
   */
  async getAllInstruments(currency: string): Promise<DeriveInstrument[]> {
    try {
      // First check if the currency exists
      const currencyDetails = await this.getCurrency(currency);
      if (!currencyDetails) {
        console.error(`Currency ${currency} not found`);
        return [];
      }

      console.log(`Fetching instruments for ${currency}...`);
      // The Derive API expects 'currency_pair' parameter, not 'currency'
      const response = await this.sendMessage<any>('get_all_instruments', {
        currency_pair: `${currency}-USD` // Format as currency pair
      });
      
      if (response.error) {
        console.error('Error fetching instruments:', response.error);
        return [];
      }
      
      console.log(`Successfully fetched instruments for ${currency}:`, response.instruments?.length || 0);
      return response.instruments || [];
    } catch (error) {
      console.error('Error fetching instruments:', error);
      return [];
    }
  }

  /**
   * Fetch detailed information for a specific instrument
   * @param instrumentName The name of the instrument to fetch details for
   */
  async getInstrumentDetails(instrumentName: string): Promise<DeriveInstrumentDetails | null> {
    try {
      const response = await this.sendMessage<any>('get_instrument', {
        instrument_name: instrumentName
      });
      
      if (response.error) {
        console.error(`Error fetching instrument details for ${instrumentName}:`, response.error);
        return null;
      }
      
      return response;
    } catch (error) {
      console.error(`Error fetching instrument details for ${instrumentName}:`, error);
      return null;
    }
  }

  /**
   * Get the complete option chain for a specific asset
   * @param currency The currency to get option chain for (e.g., "ETH", "BTC")
   */
  async getOptionChain(currency: string): Promise<DeriveOptionChain[]> {
    try {
      console.log(`Fetching option chain for ${currency}...`);
      
      // First, validate that the currency exists
      const currencyDetails = await this.getCurrency(currency);
      if (!currencyDetails) {
        console.error(`Currency ${currency} not found or not supported`);
        return [];
      }
      
      console.log(`Currency ${currency} is valid, generating mock option chain data for testing`);
      
      // Use the specific expiry dates provided
      const currentPrice = currency === 'ETH' ? 2500 : 40000;
      
      // Get current year
      const currentYear = new Date().getFullYear();
      
      // Parse the provided expiry dates
      const expiryDates = [
        new Date(), // 0 DTE (today)
        new Date(`4 Jul ${currentYear}`),
        new Date(`11 Jul ${currentYear}`),
        new Date(`18 Jul ${currentYear}`),
        new Date(`25 Jul ${currentYear}`),
        new Date(`29 Aug ${currentYear}`),
        new Date(`26 Sep ${currentYear}`),
        new Date(`26 Dec ${currentYear}`),
        new Date(`27 Mar 2026`)
      ];
      
      const mockChains: DeriveOptionChain[] = [];
      
      expiryDates.forEach((date, dateIndex) => {
        // Format the date as "D MMM" or "D MMM YYYY" for dates beyond current year
        const day = date.getDate();
        const month = date.toLocaleString('en-US', { month: 'short' });
        const year = date.getFullYear();
        const currentYear = new Date().getFullYear();
        
        // Use the format from the provided list
        let expiryDate;
        if (dateIndex === 0) {
          expiryDate = "0 DTE";
        } else if (year > currentYear) {
          expiryDate = `${day} ${month} ${year}`;
        } else {
          expiryDate = `${day} ${month}`;
        }
        
        const expiryTimestamp = date.getTime();
        
        const strikes = [];
        // Generate strikes around current price
        for (let i = -5; i <= 5; i++) {
          strikes.push(Math.round((currentPrice + i * currentPrice * 0.05) / 10) * 10);
        }
        
        const calls: DeriveOptionData[] = [];
        const puts: DeriveOptionData[] = [];
        
        strikes.forEach((strike, index) => {
          // Generate call option
          calls.push({
            strike,
            instrumentName: `${currency}-${expiryDate}-${strike}-C`,
            optionType: 'call',
            delta: 0.5 - (strike - currentPrice) / (currentPrice * 2),
            iv: 60 + Math.random() * 20,
            volume: Math.floor(Math.random() * 100),
            bidSize: Math.random() * 10,
            bidPrice: Math.max(0, (currentPrice - strike) + Math.random() * 50),
            askPrice: Math.max(0, (currentPrice - strike) + Math.random() * 50 + 10),
            askSize: Math.random() * 10
          });
          
          // Generate put option
          puts.push({
            strike,
            instrumentName: `${currency}-${expiryDate}-${strike}-P`,
            optionType: 'put',
            delta: -0.5 + (strike - currentPrice) / (currentPrice * 2),
            iv: 60 + Math.random() * 20,
            volume: Math.floor(Math.random() * 100),
            bidSize: Math.random() * 10,
            bidPrice: Math.max(0, (strike - currentPrice) + Math.random() * 50),
            askPrice: Math.max(0, (strike - currentPrice) + Math.random() * 50 + 10),
            askSize: Math.random() * 10
          });
        });
        
        mockChains.push({
          expiryDate,
          expiryTimestamp,
          instrumentId: dateIndex + 1,
          instrumentName: `${currency}-${expiryDate}`,
          options: {
            calls,
            puts
          }
        });
      });
      
      console.log(`Generated ${mockChains.length} mock option chains for ${currency}`);
      console.log('Expiry dates:', mockChains.map(chain => chain.expiryDate));
      return mockChains;
    } catch (error) {
      console.error(`Error fetching option chain for ${currency}:`, error);
      return [];
    }
  }

  /**
   * Subscribe to real-time updates for an instrument
   * @param channel The channel to subscribe to (e.g., 'ticker', 'book', 'trades')
   * @param params Parameters for the subscription
   * @param callback Function to call when updates are received
   * @returns Subscription ID that can be used to unsubscribe
   */
  async subscribe(channel: string, params: Record<string, any>, callback: (data: any) => void): Promise<string> {
    await this.connect();
    
    const id = `sub_${this.subscriptionId++}`;
    
    try {
      const response = await this.sendMessage<any>('subscribe', {
        channels: [channel],
        ...params
      });
      
      if (response.error) {
        console.error(`Subscription error for ${channel}:`, response.error);
        throw new Error(`Failed to subscribe to ${channel}: ${response.error.message}`);
      }
      
      console.log(`Successfully subscribed to ${channel}`);
      
      // Store the subscription
      this.subscriptions.set(id, {
        channel,
        ...params,
        callback
      });
      
      return id;
    } catch (error) {
      console.error(`Error subscribing to ${channel}:`, error);
      throw error;
    }
  }
  
  /**
   * Unsubscribe from a channel
   * @param subscriptionId The ID returned from subscribe()
   */
  async unsubscribe(subscriptionId: string): Promise<boolean> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      console.error(`Subscription ${subscriptionId} not found`);
      return false;
    }
    
    try {
      const response = await this.sendMessage<any>('unsubscribe', {
        channels: [subscription.channel],
        ...subscription
      });
      
      if (response.error) {
        console.error(`Unsubscribe error for ${subscription.channel}:`, response.error);
        return false;
      }
      
      this.subscriptions.delete(subscriptionId);
      console.log(`Successfully unsubscribed from ${subscription.channel}`);
      return true;
    } catch (error) {
      console.error(`Error unsubscribing from ${subscription.channel}:`, error);
      return false;
    }
  }
  
  /**
   * Subscribe to option chain updates for a specific currency
   * @param currency The currency to subscribe to (e.g., "ETH", "BTC")
   * @param callback Function to call when updates are received
   * @returns Subscription ID that can be used to unsubscribe
   */
  async subscribeToOptionChain(currency: string, callback: (data: DeriveOptionChain[]) => void): Promise<string> {
    // In a real implementation, we would subscribe to individual instruments
    // For now, we'll set up a polling mechanism to simulate real-time updates
    const id = `option_chain_${this.subscriptionId++}`;
    
    // Store the subscription
    this.subscriptions.set(id, {
      channel: 'option_chain',
      currency,
      callback
    });
    
    // Set up polling every 5 seconds
    const intervalId = setInterval(async () => {
      try {
        const chains = await this.getOptionChain(currency);
        callback(chains);
      } catch (error) {
        console.error(`Error updating option chain for ${currency}:`, error);
      }
    }, 5000);
    
    // Store the interval ID for cleanup
    const subscription = this.subscriptions.get(id);
    if (subscription) {
      subscription.intervalId = intervalId;
    }
    
    console.log(`Started polling updates for ${currency} option chain`);
    return id;
  }
  
  /**
   * Unsubscribe from option chain updates
   * @param subscriptionId The ID returned from subscribeToOptionChain()
   */
  unsubscribeFromOptionChain(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription || subscription.channel !== 'option_chain') {
      console.error(`Option chain subscription ${subscriptionId} not found`);
      return false;
    }
    
    // Clear the polling interval
    if (subscription.intervalId) {
      clearInterval(subscription.intervalId);
    }
    
    this.subscriptions.delete(subscriptionId);
    console.log(`Stopped polling updates for ${subscription.currency} option chain`);
    return true;
  }
  
  // Close the WebSocket connection
  disconnect() {
    // Clear all polling intervals
    for (const [id, subscription] of this.subscriptions.entries()) {
      if (subscription.channel === 'option_chain' && subscription.intervalId) {
        clearInterval(subscription.intervalId);
      }
    }
    
    // Clear all subscriptions
    this.subscriptions.clear();
    
    if (this.ws) {
      console.log('Closing WebSocket connection');
      this.ws.close();
      this.ws = null;
    }
  }
}

// Export a singleton instance
export const deriveService = new DeriveService();