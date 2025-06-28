/**
 * FOChainData - Tests for Derive Protocol WebSocket API Integration
 * 
 * This file contains tests for the Derive service that fetches option chain data
 * from the Derive protocol using their WebSocket API.
 */

import { deriveService } from '../app/lib/services/derive-service';

// Mock WebSocket
class MockWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  onclose: (() => void) | null = null;
  readyState = 1; // WebSocket.OPEN
  url: string;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 0);
  }

  send(data: string) {
    const message = JSON.parse(data);
    
    setTimeout(() => {
      if (this.onmessage) {
        let result;
        
        if (message.method === 'login') {
          result = {
            access_token: 'mock_access_token',
            refresh_token: 'mock_refresh_token'
          };
        } else if (message.method === 'build_register_session_key_tx') {
          result = {
            tx: 'mock_tx',
            signature: 'mock_signature'
          };
        } else if (message.method === 'register_session_key') {
          result = {
            session_key: 'mock_session_key'
          };
        } else if (message.method === 'get_all_currencies') {
          result = {
            currencies: [
              { currency: 'ETH', name: 'Ethereum' },
              { currency: 'BTC', name: 'Bitcoin' },
              { currency: 'SOL', name: 'Solana' }
            ]
          };
        } else if (message.method === 'get_currency') {
          const currency = message.params.currency;
          if (currency === 'ETH') {
            result = {
              currency: 'ETH',
              name: 'Ethereum',
              min_price: 0.01,
              max_price: 100000,
              tick_size: 0.01,
              contract_size: 1
            };
          } else if (currency === 'BTC') {
            result = {
              currency: 'BTC',
              name: 'Bitcoin',
              min_price: 0.01,
              max_price: 100000,
              tick_size: 0.01,
              contract_size: 1
            };
          } else {
            result = { error: { code: 404, message: 'Currency not found' } };
          }
        } else if (message.method === 'get_all_instruments') {
          result = {
            instruments: [
              {
                instrument_name: 'ETH-OPTION-20230901-2000-C',
                base_currency: 'ETH',
                quote_currency: 'USD',
                settlement_currency: 'USDC',
                option_type: 'call',
                strike: 2000,
                expiration_timestamp: 1693584000000,
                creation_timestamp: 1690992000000,
                instrument_id: 1
              },
              {
                instrument_name: 'ETH-OPTION-20230901-2000-P',
                base_currency: 'ETH',
                quote_currency: 'USD',
                settlement_currency: 'USDC',
                option_type: 'put',
                strike: 2000,
                expiration_timestamp: 1693584000000,
                creation_timestamp: 1690992000000,
                instrument_id: 2
              },
              {
                instrument_name: 'ETH-OPTION-20230915-2500-C',
                base_currency: 'ETH',
                quote_currency: 'USD',
                settlement_currency: 'USDC',
                option_type: 'call',
                strike: 2500,
                expiration_timestamp: 1694793600000,
                creation_timestamp: 1690992000000,
                instrument_id: 3
              }
            ]
          };
        } else if (message.method === 'get_instrument') {
          const instrumentName = message.params.instrument_name;
          if (instrumentName === 'ETH-OPTION-20230901-2000-C') {
            result = {
              instrument_name: 'ETH-OPTION-20230901-2000-C',
              tick_size: 0.01,
              taker_commission: 0.0003,
              maker_commission: 0.0001,
              min_trade_amount: 0.1,
              contract_size: 1,
              block_trade_commission: 0.0001,
              block_trade_min_trade_amount: 10,
              option_type: 'call',
              strike: 2000,
              settlement_period: 'day',
              quote_currency: 'USD',
              base_currency: 'ETH',
              settlement_currency: 'USDC',
              is_active: true,
              expiration_timestamp: 1693584000000,
              creation_timestamp: 1690992000000,
              price_index: 'ETH_USD',
              kind: 'option'
            };
          } else if (instrumentName === 'ETH-OPTION-20230901-2000-P') {
            result = {
              instrument_name: 'ETH-OPTION-20230901-2000-P',
              tick_size: 0.01,
              taker_commission: 0.0003,
              maker_commission: 0.0001,
              min_trade_amount: 0.1,
              contract_size: 1,
              block_trade_commission: 0.0001,
              block_trade_min_trade_amount: 10,
              option_type: 'put',
              strike: 2000,
              settlement_period: 'day',
              quote_currency: 'USD',
              base_currency: 'ETH',
              settlement_currency: 'USDC',
              is_active: true,
              expiration_timestamp: 1693584000000,
              creation_timestamp: 1690992000000,
              price_index: 'ETH_USD',
              kind: 'option'
            };
          } else if (instrumentName === 'ETH-OPTION-20230915-2500-C') {
            result = {
              instrument_name: 'ETH-OPTION-20230915-2500-C',
              tick_size: 0.01,
              taker_commission: 0.0003,
              maker_commission: 0.0001,
              min_trade_amount: 0.1,
              contract_size: 1,
              block_trade_commission: 0.0001,
              block_trade_min_trade_amount: 10,
              option_type: 'call',
              strike: 2500,
              settlement_period: 'day',
              quote_currency: 'USD',
              base_currency: 'ETH',
              settlement_currency: 'USDC',
              is_active: true,
              expiration_timestamp: 1694793600000,
              creation_timestamp: 1690992000000,
              price_index: 'ETH_USD',
              kind: 'option'
            };
          }
        }
        
        this.onmessage({
          data: JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            result
          })
        });
      }
    }, 10);
  }

  close() {
    if (this.onclose) this.onclose();
  }
}

// Mock global WebSocket
global.WebSocket = MockWebSocket as any;

describe('Derive Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should login successfully', async () => {
      const result = await deriveService.login('test@example.com', 'password');
      expect(result).toBe(true);
    });
  });

  describe('registerSessionKey', () => {
    it('should register session key successfully after login', async () => {
      await deriveService.login('test@example.com', 'password');
      const result = await deriveService.registerSessionKey();
      expect(result).toBe(true);
    });
  });

  describe('getAllCurrencies', () => {
    it('should fetch all available currencies', async () => {
      const currencies = await deriveService.getAllCurrencies();
      
      expect(currencies).toHaveLength(3);
      expect(currencies[0].currency).toBe('ETH');
      expect(currencies[1].currency).toBe('BTC');
      expect(currencies[2].currency).toBe('SOL');
    });
  });

  describe('getCurrency', () => {
    it('should fetch details for a specific currency', async () => {
      const currency = await deriveService.getCurrency('ETH');
      
      expect(currency.currency).toBe('ETH');
      expect(currency.name).toBe('Ethereum');
    });

    it('should return null for non-existent currency', async () => {
      const currency = await deriveService.getCurrency('XYZ');
      
      expect(currency).toBeNull();
    });
  });

  describe('getAllInstruments', () => {
    it('should fetch all instruments for a currency', async () => {
      const instruments = await deriveService.getAllInstruments('ETH');
      
      expect(instruments).toHaveLength(3);
      expect(instruments[0].instrument_name).toBe('ETH-OPTION-20230901-2000-C');
      expect(instruments[1].instrument_name).toBe('ETH-OPTION-20230901-2000-P');
      expect(instruments[2].instrument_name).toBe('ETH-OPTION-20230915-2500-C');
    });

    it('should return empty array for non-existent currency', async () => {
      const instruments = await deriveService.getAllInstruments('XYZ');
      
      expect(instruments).toEqual([]);
    });
  });

  describe('getInstrumentDetails', () => {
    it('should fetch details for a specific instrument', async () => {
      const details = await deriveService.getInstrumentDetails('ETH-OPTION-20230901-2000-C');
      
      expect(details?.instrument_name).toBe('ETH-OPTION-20230901-2000-C');
      expect(details?.option_type).toBe('call');
      expect(details?.strike).toBe(2000);
      expect(details?.expiration_timestamp).toBe(1693584000000);
    });
  });

  describe('getOptionChain', () => {
    it('should fetch the complete option chain for a currency', async () => {
      const optionChains = await deriveService.getOptionChain('ETH');
      
      expect(optionChains).toHaveLength(2);
      
      // First expiry date
      expect(optionChains[0].expiryTimestamp).toBe(1693584000000);
      expect(optionChains[0].options.calls).toHaveLength(1);
      expect(optionChains[0].options.puts).toHaveLength(1);
      expect(optionChains[0].options.calls[0].strike).toBe(2000);
      expect(optionChains[0].options.puts[0].strike).toBe(2000);
      
      // Second expiry date
      expect(optionChains[1].expiryTimestamp).toBe(1694793600000);
      expect(optionChains[1].options.calls).toHaveLength(1);
      expect(optionChains[1].options.puts).toHaveLength(0);
      expect(optionChains[1].options.calls[0].strike).toBe(2500);
    });
  });
});