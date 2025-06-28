"use client";

// import { useNetwork } from "@/app/context/network-context";
// import { ARBITRUM_NETWORK } from "@/app/lib/constants";
import FutureDropdown from "@/app/ui/future/future-dropdown";
// import OptionSlider from "@/app/ui/options/option-slider";
import PositionsSection from "@/app/ui/options/positions-section";
import { CaretDown, Plus, PlusSquare, X } from "@phosphor-icons/react";
import { TrendDown, TrendUp } from "@phosphor-icons/react/dist/ssr";
import axios from "axios";
// import { useWeb3React } from "@web3-react/core";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { deriveService } from "@/app/lib/services/derive-service";

/**
 * FOChainData - Option Chain Data Integration
 * 
 * This component fetches and displays option chain data from the Derive protocol
 * using WebSocket API. It replaces the dummy data with real-time market data.
 */

type OptionType = "All" | "Calls" | "Puts";
type DateOption = string;
type GreekOption = "Delta" | "Mark Price" | "Gamma" | "Vega" | "Theta";

export default function Page() {
  // const { account, library } = useWeb3React();
  // const { currentNetwork } = useNetwork();

  const pairOptions: Option[] = [
    { value: "ETH", label: "ETH/USD", icon: "/eth-icon.svg" },
    { value: "BTC", label: "BTC/USD", icon: "/btc-icon.svg" },
  ];

  const [selectedOption, setSelectedOption] = useState<OptionType>("All");
  const [selectedDate, setSelectedDate] = useState<DateOption>("2 Sep");
  const [selectedGreeks, setSelectedGreeks] = useState<GreekOption[]>([
    "Delta",
    "Mark Price",
  ]);

  const optionTypes: OptionType[] = ["All", "Calls", "Puts"];
  const [dateOptions, setDateOptions] = useState<DateOption[]>([]);
  const greekOptions: GreekOption[] = [
    "Delta",
    "Mark Price",
    "Gamma",
    "Vega",
    "Theta",
  ];

  const orderTypeOptions: Option[] = [
    { value: "Limit", label: "Limit" },
    { value: "RFQ", label: "RFQ" },
  ];

  const [selectedPair, setSelectedPair] = useState<Option>(pairOptions[0]);
  const selectedPairRef = useRef(selectedPair);
  const [marketPrice, setMarketPrice] = useState<number>(1);

  const [selectedOrderType, setSelectedOrderType] = useState<Option>(
    orderTypeOptions[0]
  );
  // const [leverageValue, setLeverageValue] = useState<number>(50);

  const handleOptionChange = (option: OptionType) => {
    setSelectedOption(option);
  };

  const handleDateChange = (date: DateOption) => {
    setSelectedDate(date);
  };

  const handleGreekChange = (greek: GreekOption) => {
    setSelectedGreeks((prev) =>
      prev.includes(greek) ? prev.filter((g) => g !== greek) : [...prev, greek]
    );
  };
  
  // Update countdown for 0 DTE to 1PM
  const updateDTECountdown = () => {
    const now = new Date();
    const targetTime = new Date();
    targetTime.setHours(13, 0, 0, 0); // Set to 1 PM
    
    // If it's already past 1 PM, set to tomorrow 1 PM
    if (now > targetTime) {
      targetTime.setDate(targetTime.getDate() + 1);
    }
    
    const diffMs = targetTime.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    setFormattedDateDisplay(`0 DTE - ${diffHours}h ${diffMinutes}m ${diffSeconds}s`);
  };
  
  // Compare current and previous values to determine flash direction
  const compareValues = (currentValue: number | undefined, previousValue: number | undefined, key: string) => {
    if (currentValue === undefined || previousValue === undefined) return '';
    
    if (currentValue > previousValue) {
      return 'flash-increase';
    } else if (currentValue < previousValue) {
      return 'flash-decrease';
    }
    
    return '';
  };

  const date = new Date();
  const today =
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0");

  const [optionChains, setOptionChains] = useState<any[]>([]);
  const [currentOptionChain, setCurrentOptionChain] = useState<any | null>(null);
  const [previousOptionChain, setPreviousOptionChain] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [flashingCells, setFlashingCells] = useState<Record<string, 'increase' | 'decrease'>>({});
  const [formattedDateDisplay, setFormattedDateDisplay] = useState<string>('');

  // const tableRef = useRef<HTMLDivElement>(null);
  // const [labelPosition, setLabelPosition] = useState<number>(0);

  const [size, setSize] = useState<string | undefined>(undefined);
  const [limitPrice, setLimitPrice] = useState<string | undefined>(undefined);

  // const updateLabelPosition = () => {
  //   if (tableRef.current) {
  //     const lowerStrike = Math.floor(currentPrice / 100) * 100;
  //     const upperStrike = lowerStrike + 100;
  //     const position =
  //       (currentPrice - lowerStrike) / (upperStrike - lowerStrike);

  //     const rows = tableRef.current.querySelectorAll("tbody tr");
  //     const targetRow = Array.from(rows).find((row) => {
  //       const strike = parseInt(row.children[7].textContent || "0", 10);
  //       return strike <= currentPrice && currentPrice < strike + 100;
  //     });

  //     if (targetRow) {
  //       const rowRect = targetRow.getBoundingClientRect();
  //       const tableRect = tableRef.current.getBoundingClientRect();
  //       setLabelPosition(
  //         rowRect.top - tableRect.top + rowRect.height * position
  //       );
  //     }
  //   }
  // };

  // useEffect(() => {
  //   updateLabelPosition();
  //   window.addEventListener('resize', updateLabelPosition);
  //   return () => window.removeEventListener('resize', updateLabelPosition);
  // }, [currentPrice]);

  const getPriceFromAssetsArray = (
    tokenSymbol: string,
    assets: any[]
  ) => {
    tokenSymbol =
      tokenSymbol === "WETH" || tokenSymbol === "WBTC"
        ? tokenSymbol.substring(1)
        : tokenSymbol;
    for (const asset of assets) {
      if (asset.symbol === tokenSymbol) {
        return asset.price;
      }
    }
    return 1;
  };

  const getAssetPrice = async (assetName = selectedPairRef.current.value) => {
    const rsp = await axios.get("https://app.mux.network/api/liquidityAsset", {
      timeout: 10 * 1000,
    });

    const price = getPriceFromAssetsArray(assetName, rsp.data.assets);
    setMarketPrice(price);

    return price;
  };

  const [error, setError] = useState<string | null>(null);
  const [availableCurrencies, setAvailableCurrencies] = useState<string[]>([]);

  const fetchAvailableCurrencies = async () => {
    try {
      const currencies = await deriveService.getAllCurrencies();
      const currencyCodes = currencies.map((c: any) => c.currency);
      setAvailableCurrencies(currencyCodes);
      console.log('Available currencies:', currencyCodes);
      return currencyCodes;
    } catch (error) {
      console.error('Error fetching available currencies:', error);
      // Fallback to hardcoded currencies if API fails
      const fallbackCurrencies = ['BTC', 'ETH'];
      setAvailableCurrencies(fallbackCurrencies);
      return fallbackCurrencies;
    }
  };

  const fetchOptionChainData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Fetching option chain data...');
      const currency = selectedPair.value;
      
      // Check if we have fetched available currencies
      if (availableCurrencies.length === 0) {
        const currencies = await fetchAvailableCurrencies();
        if (!currencies.includes(currency)) {
          setError(`Currency ${currency} is not available on the Derive API. Available currencies: ${currencies.join(', ')}`);
          setOptionChains([]);
          setDateOptions([]);
          setCurrentOptionChain(null);
          setIsLoading(false);
          return;
        }
      } else if (!availableCurrencies.includes(currency)) {
        setError(`Currency ${currency} is not available on the Derive API. Available currencies: ${availableCurrencies.join(', ')}`);
        setOptionChains([]);
        setDateOptions([]);
        setCurrentOptionChain(null);
        setIsLoading(false);
        return;
      }
      
      // Unsubscribe from previous subscription if exists
      if (subscriptionId) {
        console.log(`Unsubscribing from previous option chain updates (${subscriptionId})`);
        deriveService.unsubscribeFromOptionChain(subscriptionId);
        setSubscriptionId(null);
      }
      
      // Initial fetch
      const chains = await deriveService.getOptionChain(currency);
      console.log(`Received ${chains.length} option chains`);
      
      if (chains.length === 0) {
        setError(`No option data found for ${currency}. The currency might not have any options available.`);
        setOptionChains([]);
        setDateOptions([]);
        setCurrentOptionChain(null);
        return;
      }
      
      setOptionChains(chains);
      
      // Extract expiry dates for the dropdown
      const dates = chains.map(chain => chain.expiryDate);
      setDateOptions(dates);
      
      // Set default selected date to the first available expiry
      if (dates.length > 0) {
        setSelectedDate(dates[0]);
        setCurrentOptionChain(chains[0]);
      }
      
      // Subscribe to real-time updates
      console.log(`Subscribing to real-time updates for ${currency} option chain`);
      const newSubscriptionId = await deriveService.subscribeToOptionChain(currency, (updatedChains) => {
        console.log(`Received real-time update for ${currency} option chain`);
        setOptionChains(updatedChains);
        
        // Update current option chain if date matches
        if (selectedDate) {
          const updatedChain = updatedChains.find(chain => chain.expiryDate === selectedDate);
          if (updatedChain) {
            setCurrentOptionChain(updatedChain);
          }
        }
      });
      
      setSubscriptionId(newSubscriptionId);
      console.log(`Subscribed to ${currency} option chain updates with ID: ${newSubscriptionId}`);
      
    } catch (error) {
      console.error('Error fetching option chain data:', error);
      setError('Failed to fetch option chain data. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch available currencies on component mount
  useEffect(() => {
    fetchAvailableCurrencies();
  }, []);

  useEffect(() => {
    selectedPairRef.current = selectedPair;
    fetchOptionChainData();
  }, [selectedPair]);

  useEffect(() => {
    // Find the option chain that matches the selected date
    if (optionChains.length > 0 && selectedDate) {
      const chain = optionChains.find(chain => chain.expiryDate === selectedDate);
      
      // Save previous chain for comparison
      if (currentOptionChain) {
        setPreviousOptionChain(currentOptionChain);
      }
      
      setCurrentOptionChain(chain || null);
    }
  }, [selectedDate, optionChains]);
  
  // Format the date display based on the selected date
  useEffect(() => {
    if (!selectedDate) return;
    
    if (selectedDate.startsWith('0 DTE')) {
      // Initial update
      updateDTECountdown();
      
      // Set up interval for continuous updates
      const timerId = setInterval(updateDTECountdown, 1000);
      return () => clearInterval(timerId);
    } else {
      setFormattedDateDisplay(selectedDate);
    }
  }, [selectedDate]);
  
  // Clear flashing cells after animation completes
  useEffect(() => {
    if (Object.keys(flashingCells).length > 0) {
      const timer = setTimeout(() => {
        setFlashingCells({});
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [flashingCells]);

  useEffect(() => {
    const intervalId = setInterval(getAssetPrice, 5000); // Update price every 5 seconds
    
    return () => {
      clearInterval(intervalId);
      
      // Clean up subscription
      if (subscriptionId) {
        console.log(`Cleaning up subscription: ${subscriptionId}`);
        deriveService.unsubscribeFromOptionChain(subscriptionId);
      }
      
      deriveService.disconnect(); // Clean up WebSocket connection
    };
  }, []);

  return (
    <div className="flex flex-col lg:flex-row space-x-0 lg:space-x-5 text-base pt-8 px-3 xs:px-5 lg:px-6 custom-scrollbar text-baseBlack dark:text-baseWhite">
      <div className="w-full lg:w-[70%] mx-auto mb-6">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-2 gap-4">
          <div className="w-fit flex flex-col h-[4.5rem] border border-neutral-100 dark:border-neutral-700 rounded-xl px-2 py-2 font-semibold text-xl">
            <div className="text-neutral-500 text-xs font-medium mb-1">
              Select Pair
            </div>
            <div className="flex flex-row justify-between items-center">
              <FutureDropdown
                options={pairOptions}
                defaultValue={selectedPair}
                onChange={setSelectedPair}
              />
              <span className="text-green-500 ml-2 font-semibold">{marketPrice}</span>
              {/* <span className="text-sm text-green-500 ml-1">+1.09%</span> */}
            </div>
          </div>

          <div className="w-full xs:h-[4.5rem] flex flex-row flex-wrap xs:flex-nowrap justify-between px-6 py-2 xs:py-4 border border-neutral-100 dark:border-neutral-700 rounded-xl font-semibold">
            <div className="my-1.5 xs:my-0">
              <p className="text-neutral-500 text-xs">24H Volume</p>
              <p className="text-sm">$2.11m</p>
            </div>
            <div className="col-span-2 my-1.5 xs:my-0">
              <p className="text-neutral-500 text-xs">
                Open Interest (45%/55%)
              </p>
              <div className="flex items-center space-x-1">
                <TrendUp size={16} color="#22c55e" />
                <span className="text-sm">$668.4k</span>&nbsp;
                <TrendDown size={15} color="#ef4444" />
                <span className="text-sm">$805.5k</span>
              </div>
            </div>
            <div className="my-1.5 xs:my-0">
              <p className="text-neutral-500 text-xs">24H Trade</p>
              <p className="text-sm">58,289.70</p>
            </div>
          </div>
        </div>

        <div className="py-4 rounded-lg mb-5">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-4 space-y-3.5 xl:space-y-0">
            <div className="flex flex-wrap gap-4 ml-1.5 text-base font-semibold">
              {optionTypes.map((option) => (
                <button
                  key={option}
                  onClick={() => handleOptionChange(option)}
                  className={`px-4 py-2 rounded-md ${
                    selectedOption === option
                      ? "bg-purpleBG-lighter dark:bg-baseDarkComplementary border border-purple"
                      : ""
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-4 items-center text-xs font-semibold">
              {greekOptions.map((greek) => (
                <label key={greek} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedGreeks.includes(greek)}
                    onChange={() => handleGreekChange(greek)}
                    className="sr-only"
                  />
                  <div
                    className={`w-5 h-5 rounded mr-2 flex items-center justify-center ${
                      selectedGreeks.includes(greek)
                        ? "bg-purple"
                        : "bg-white border border-baseBlack dark:border-baseWhite"
                    }`}
                  >
                    {selectedGreeks.includes(greek) && (
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M5 13l4 4L19 7"></path>
                      </svg>
                    )}
                  </div>
                  <span>{greek}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap sm:justify-between text-xs font-semibold">
            {dateOptions.map((date) => (
              <button
                key={date}
                onClick={() => handleDateChange(date)}
                className={`px-2.5 xl:px-5 ml-2.5 sm:ml-0 mt-2.5 sm:mt-0 py-2.5 rounded-md ${
                  selectedDate === date
                    ? "bg-purpleBG-lighter dark:bg-baseDarkComplementary border border-purple"
                    : "border border-neutral-300 dark:border-neutral-700"
                }`}
              >
                {date}
              </button>
            ))}
            <button className="px-2.5 py-2 ml-2.5 sm:ml-0 mt-2.5 sm:mt-0 rounded-lg text-xs font-semibold border border-neutral-300 dark:border-neutral-700 flex items-center">
              Next month <CaretDown size={16} className="ml-2" />
            </button>
          </div>
        </div>

        <div className="relative mb-2.5 w-full h-96">
          <div className="overflow-auto max-w-full 2xl:w-full max-h-full">
            <table className="bg-white dark:bg-baseDark w-full">
              <thead>
                <tr className="text-base font-medium border border-neutral-100 dark:border-neutral-700">
                  <th className="py-3 px-6 text-center" colSpan={7}>
                    Calls
                  </th>
                  <th className="py-3 text-center text-nowrap w-24" colSpan={1}>
                    {selectedDate?.startsWith('0 DTE') ? formattedDateDisplay : selectedDate || today}
                  </th>
                  <th className="py-3 px-6 text-center" colSpan={7}>
                    Puts
                  </th>
                </tr>
                <tr className="text-neutral-500 text-xs text-nowrap">
                  <th className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">
                    Delta
                  </th>
                  <th className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">
                    IV
                  </th>
                  <th className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">
                    Volume
                  </th>
                  <th className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">
                    Bid Size
                  </th>
                  <th className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">
                    Bid Price
                  </th>
                  <th className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">
                    Ask Price
                  </th>
                  <th className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">
                    Ask Size
                  </th>
                  <th className="py-3 px-5 text-center border-x border-neutral-100 dark:border-neutral-700 w-24">
                    Strike
                  </th>
                  <th className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">
                    Bid Size
                  </th>
                  <th className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">
                    Bid Price
                  </th>
                  <th className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">
                    Ask Price
                  </th>
                  <th className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">
                    Ask Size
                  </th>
                  <th className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">
                    Volume
                  </th>
                  <th className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">
                    IV
                  </th>
                  <th className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">
                    Delta
                  </th>
                </tr>
              </thead>
              <tbody className="text-xs font-normal">
                {isLoading ? (
                  <tr>
                    <td colSpan={15} className="py-10 text-center">
                      Loading option chain data...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={15} className="py-10 text-center text-baseSecondary-500">
                      {error}
                      <div className="mt-2">
                        <button 
                          onClick={fetchOptionChainData}
                          className="px-4 py-2 bg-purple text-white rounded-md text-sm"
                        >
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : currentOptionChain ? (
                  currentOptionChain.options.calls.map((call: any, index: number) => {
                    const put = currentOptionChain.options.puts.find(
                      (p: any) => p.strike === call.strike
                    );
                    return (
                      <tr key={index}>
                        <td className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">
                          {call.delta?.toFixed(5) || '-'}
                        </td>
                        <td className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">
                          {call.iv?.toFixed(2) || '-'}
                        </td>
                        <td className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">
                          {call.volume?.toFixed(0) || '-'}
                        </td>
                        <td className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">
                          {call.bidSize?.toFixed(2) || '-'}
                        </td>
                        <td className={`py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700 text-baseSuccess-300 hover:bg-baseSuccess-100 ${previousOptionChain ? compareValues(call.bidPrice, previousOptionChain.options.calls.find((p: any) => p.strike === call.strike)?.bidPrice, `call-bid-${call.strike}`) : ''}`}>
                          <div className="flex flex-row justify-between">
                            {call.bidPrice?.toFixed(1) || '-'}
                            <PlusSquare size={16} />
                          </div>
                        </td>
                        <td className={`py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700 text-baseSecondary-500 hover:bg-baseSecondary-300 ${previousOptionChain ? compareValues(call.askPrice, previousOptionChain.options.calls.find((p: any) => p.strike === call.strike)?.askPrice, `call-ask-${call.strike}`) : ''}`}>
                          <div className="flex flex-row justify-between">
                            {call.askPrice?.toFixed(1) || '-'}
                            <PlusSquare size={16} />
                          </div>
                        </td>
                        <td className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">
                          {call.askSize?.toFixed(2) || '-'}
                        </td>
                        <td className="py-3 px-2 text-center border-x border-neutral-100 dark:border-neutral-700 font-medium w-24">
                          {call.strike}
                        </td>
                        {put ? (
                          <>
                            <td className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">
                              {put.bidSize?.toFixed(2) || '-'}
                            </td>
                            <td className={`py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700 text-baseSuccess-300 hover:bg-baseSuccess-100 ${previousOptionChain ? compareValues(put.bidPrice, previousOptionChain.options.puts.find((p: any) => p.strike === put.strike)?.bidPrice, `put-bid-${put.strike}`) : ''}`}>
                              <div className="flex flex-row justify-between">
                                {put.bidPrice?.toFixed(1) || '-'}
                                <PlusSquare size={16} />
                              </div>
                            </td>
                            <td className={`py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700 text-baseSecondary-500 hover:bg-baseSecondary-300 ${previousOptionChain ? compareValues(put.askPrice, previousOptionChain.options.puts.find((p: any) => p.strike === put.strike)?.askPrice, `put-ask-${put.strike}`) : ''}`}>
                              <div className="flex flex-row justify-between">
                                {put.askPrice?.toFixed(1) || '-'}
                                <PlusSquare size={16} />
                              </div>
                            </td>
                            <td className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">
                              {put.askSize?.toFixed(2) || '-'}
                            </td>
                            <td className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">
                              {put.volume?.toFixed(0) || '-'}
                            </td>
                            <td className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">
                              {put.iv?.toFixed(2) || '-'}
                            </td>
                            <td className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">
                              {put.delta?.toFixed(5) || '-'}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">-</td>
                            <td className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">-</td>
                            <td className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">-</td>
                            <td className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">-</td>
                            <td className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">-</td>
                            <td className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">-</td>
                            <td className="py-3 px-2 text-left border-b border-neutral-100 dark:border-neutral-700">-</td>
                          </>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={15} className="py-10 text-center">
                      No option chain data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {/* <div
              className="absolute left-1/2 transform -translate-x-1/2 text-white top-10"
            >
              <div className="relative w-20 h-8 flex items-center justify-center bg-gradient-to-r from-gradient-1 to-gradient-2 rounded-md">
                <span className="relative text-white font-semibold text-xs z-10">
                  ETH {currentPrice.toFixed(1)}
                </span>
              </div>
            </div> */}
          </div>
        </div>

        <div>
          <PositionsSection />
        </div>
      </div>

      <div className="flex-none w-full lg:w-[30%] pb-9">
        <div className="bg-baseComplementary dark:bg-baseDarkComplementary p-2 px-3 pb-6 rounded-3xl w-full">
          <div className="ml-auto flex items-center justify-between py-2 mb-5">
            <div className="text-2xl font-normal">Long Call</div>
            <div className="flex flex-row items-center font-medium text-base p-2 bg-white dark:bg-baseDark rounded-md">
              <FutureDropdown
                options={orderTypeOptions}
                defaultValue={selectedOrderType}
                onChange={setSelectedOrderType}
              />
            </div>
          </div>

          <div className="bg-purple-100 rounded py-1 text-base font-semibold inline-block mb-4">
            Multiple Calls
            {/* <span className="px-2 inline-flex text-xs leading-4 font-medium rounded-md bg-purpleBG-lighter text-purple">
                Long
              </span> */}
          </div>

          <div className="flex flex-row justify-between mb-5">
            <div className="flex flex-row">
              <Image
                src="/eth-icon.svg"
                width="24"
                height="24"
                alt="token"
                className="ml-2"
              />
              <div className="flex flex-col ml-2">
                <span className="text-xs font-semibold">
                  BTC $53000 Call
                </span>
                <span className="text-xs font-normal text-neutral-500">
                  Exp 13 sep
                </span>
              </div>
            </div>
            <div className="flex flex-row mr-1">
              <span className="text-xs font-semibold mr-2">
                $4990.00
              </span>
              <X size={14} />
            </div>
          </div>

          <div className="mb-5">
            <button className="flex items-center bg-white dark:bg-baseDark mb-4 px-2 py-1 text-purple">
              <Plus size={20} />
              <span className="ml-1 text-xs font-semibold">Add Option</span>
            </button>
          </div>

          <div className="flex justify-between my-5">
            <div className="text-xs">
              <span className="text-neutral-500">Avail: </span>
              <span>0.00 USDT</span>
            </div>
          </div>

          <div className="flex w-full rounded-xl bg-white dark:bg-baseDark py-2 pl-2 mb-5">
            <input
              type="number"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="w-full text-baseBlack dark:text-baseWhite dark:bg-baseDark text-sm font-normal outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="Size"
              min={0}
            />
          </div>

          <div className="flex w-full rounded-xl bg-white dark:bg-baseDark py-2 pl-2 mb-5">
            <input
              type="number"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              className="w-full text-baseBlack dark:text-baseWhite dark:bg-baseDark text-sm font-normal outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="Limit Price"
              min={0}
            />
          </div>

          <div className="flex text-xs my-5">
            <span className="text-neutral-500">Bid: </span>
            <span className="text-baseSuccess-300">$335.8</span>
            <span className="text-neutral-500 ml-1">Ask: </span>
            <span className="text-baseSecondary-500">$346.8</span>
          </div>

          {/* <div className="flex justify-between items-center mb-5">
            <OptionSlider value={leverageValue} onChange={setLeverageValue} />
          </div> */}

          <div className="space-y-2 text-xs font-normal py-5 px-4 mb-5 border-y border-purpleBG-lighter dark:border-neutral-700">
            <div className="flex justify-between">
              <span>Min Received</span>
              <span>$215.70</span>
            </div>
            <div className="flex justify-between">
              <span>Fees</span>
              <span>-</span>
            </div>
            <div className="flex justify-between">
              <span>Mark Price</span>
              <span>$230.80</span>
            </div>
            <div className="flex justify-between">
              <span>Liquidation Price</span>
              <span>-</span>
            </div>
            <div className="flex justify-between">
              <span>Margin Required</span>
              <span>-</span>
            </div>
          </div>

          <div className="flex gap-4">
            <button className="w-full bg-baseSuccess-300 text-white py-2.5 px-5 rounded-md text-base font-semibold text-center">
              Buy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
