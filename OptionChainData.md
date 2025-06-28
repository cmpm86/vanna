# OptionChainData - Option Chain Data Integration

This document describes the implementation of the option chain data integration with the Derive protocol using WebSocket API.

## Overview

The implementation fetches option chain data from the Derive protocol using their WebSocket API. It replaces the dummy data in the options trading page with real-time market data.

## Implementation Details

### 1. Derive Service (`app/lib/services/derive-service.ts`)

A service that handles WebSocket communication with the Derive protocol API. It provides methods to:

- Connect to the WebSocket API at `wss://www.derive.xyz/ws/api/v2/`
- Authenticate with the API (login, register session key)
- Fetch all available instruments for a specific currency
- Fetch detailed information for a specific instrument
- Get the complete option chain for a specific asset

### 2. Options Page Update (`app/trade/options/page.tsx`)

The options page has been updated to:

- Use the Derive service to fetch real option chain data
- Display the data in the existing UI
- Handle loading states and errors
- Dynamically populate expiry dates based on available data
- Show appropriate error messages when no data is found

### 3. Testing (`__tests__/derive-service.test.ts`)

Tests have been added to verify the functionality of the Derive service:

- Mock WebSocket implementation for testing
- Tests for authentication flow
- Tests for fetching instruments
- Tests for fetching instrument details
- Tests for getting the complete option chain

## How It Works

1. When the options page loads, it initializes a WebSocket connection to the Derive API
2. It fetches all available instruments for the selected currency (ETH or BTC)
3. It filters and groups the instruments by expiry date
4. For each instrument, it fetches detailed information
5. The data is processed and displayed in the option chain table
6. When the user changes the selected currency or expiry date, the data is updated accordingly

## API Integration

The integration uses the following endpoints from the Derive protocol:

1. `login` - Authenticates the user and gets access tokens
2. `build_register_session_key_tx` - Builds a transaction for registering a session key
3. `register_session_key` - Registers a session key for API access
4. `get_all_currencies` - Retrieves the list of all available currencies
5. `get_currency` - Fetches details for a specific currency
6. `get_all_instruments` - Retrieves the list of available instruments
7. `get_instrument` - Fetches detailed data for a specific instrument

By combining these endpoints, we derive the complete option chain data for a given asset and its expiries.

## API URL

The WebSocket API URL for the Derive protocol is:

```
wss://www.derive.xyz/ws/api/v2/
```

## Testing

Tests can be run using:

```bash
npm test
```

The tests use Jest and mock the WebSocket API to verify the functionality of the Derive service.