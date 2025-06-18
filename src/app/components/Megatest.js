// src/app/test-megaeth/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { createWalletClient, custom, publicActions, http} from 'viem'
import { megaethTestnet } from 'viem/chains'
import { Loader2, Zap } from 'lucide-react'
import { useWallets, getEmbeddedConnectedWallet } from '@privy-io/react-auth'
import {useLogin, usePrivy} from '@privy-io/react-auth';

const NETWORKS = [
  {
    id: 'select',
    name: 'Select Network',
    color: 'gray',
    chainId: 0,
    endpoint: ''
  },
  {
    id: 'megaeth',
    name: 'MegaETH',
    color: 'yellow',
    chainId: 6342,
    endpoint: 'realtime_sendRawTransaction'
  },]

export default function Megatest() {
  const [selectedNetwork, setSelectedNetwork] = useState(NETWORKS[1])
  const [isInitializing, setIsInitializing] = useState(false)
  const [preSignedPool, setPreSignedPool] = useState(null)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [transactionHistory, setTransactionHistory] = useState([])

  // Cache clients to avoid recreation

  const { ready, authenticated } = usePrivy();


  const { wallets } = useWallets()
  const embeddedWallet = getEmbeddedConnectedWallet(wallets)

  const CONTRACT_ADDRESSES = "0x0D0ba0Ea8d031d093eA36c1A1176B066Fd08fadB"

  const clientRef = useRef(null)

  // Create and cache client
  const getNetworkClient = async () => {
    console.log('Creating client for MegaETH Testnet...')
    const provider = await embeddedWallet?.getEthereumProvider()
    if (!provider) {
      console.error('No Ethereum provider found for embedded wallet')
      return null
    }
    if (!clientRef.current) {
      clientRef.current = createWalletClient({
        //@ts-ignore
        account: embeddedWallet.address,
        chain: megaethTestnet,
        transport: custom(provider),
      }).extend(publicActions)
    }



    return {
      walletClient: clientRef.current,
    }
  }


  const extendPool = async () => {
    try {
      setPreSignedPool(prev => {
        if (!prev || prev.isRefilling) return prev
        return { ...prev, isRefilling: true }
      })

      const { walletClient } = await getNetworkClient()
      if (!walletClient) return

      console.log(`Extending pool for MegaETH Testnet...`)

      const currentPool = preSignedPool
      const nextNonce = currentPool.baseNonce + currentPool.transactions.length

      // Use same gas logic as initialization
      let gasPrice
      let gasLimit

      try {
        const networkGasPrice = await walletClient.getGasPrice()

        gasPrice = networkGasPrice
        gasLimit = 100000n

      } catch (gasError) {
        gasPrice = 1000000000n
        gasLimit = 50000n
      }

      // Pre-sign 10 more transactions
      const signingPromises = Array.from({ length: 10 }, async (_, i) => {
        return await walletClient.signTransaction({
          account: embeddedWallet.address,
          to: CONTRACT_ADDRESSES,
          data: '0xa2e62045',
          nonce: nextNonce + i,
          maxFeePerGas: gasPrice,
          maxPriorityFeePerGas: gasPrice / 10n,
          value: 0n,
          type: 'eip1559',
          gas: gasLimit,
        })
      })

      const newTransactions = await Promise.all(signingPromises)

      // EXTEND the pool (append new transactions)
      setPreSignedPool(prev => {
        if (!prev) return null
        return {
          ...prev,
          transactions: [...prev.transactions, ...newTransactions],
          isRefilling: false,
          hasTriggeredRefill: false  // Reset flag for next refill
        }
      })

      console.log(`✅ Extended pool with 10 more transactions. Total: ${currentPool.transactions.length + 10}`)

    } catch (error) {
      console.error('❌ Failed to extend pool:', error)
      setPreSignedPool(prev => prev ? { ...prev, isRefilling: false } : null)
    }
  }

  const initializeNetwork = async () => {

    setIsInitializing(true)
    setError('')
    setPreSignedPool(null)

    try {
      const { walletClient } = await getNetworkClient()

      if (!walletClient) throw new Error('Failed to create wallet client')
      
      console.log(`🚀 Initializing MegaETH Testnet with pre-signed transactions...`)

      const nonce = await walletClient.getTransactionCount({
        address: embeddedWallet.address,
      })

      console.log(`Current nonce for ${embeddedWallet.address}: ${nonce}`)
      // Get actual gas price from network and apply smart adjustments
      let gasPrice
      let gasLimit

      try {
        const networkGasPrice = await walletClient.getGasPrice()
        gasPrice = networkGasPrice
        gasLimit = 100000n

      } catch (gasError) {
        console.warn('⚠️ Failed to get gas price, using fallback:', gasError)
        // Fallback to very low prices for testnets
        gasPrice = 1000000000n // 1 gwei
        gasLimit = 50000n
      }

      // Pre-sign 10 transactions initially
      console.log(`Pre-signing 10 transactions...`)
      const signingPromises = Array.from({ length: 10 }, async (_, i) => {
        /*return await walletClient.getBalance({
          address: embeddedWallet.address,
        })*/
        return await walletClient.signTransaction({
          account: embeddedWallet.address,
          to: CONTRACT_ADDRESSES,
          data: '0xa2e62045',
          nonce: nonce + i,
          maxFeePerGas: gasPrice,
          maxPriorityFeePerGas: gasPrice / 10n, 
          value: 0n,
          type: 'eip1559',
          gas: gasLimit,
        })
      })

      const transactions = await Promise.all(signingPromises)

      setPreSignedPool({
        transactions,
        currentIndex: 0,
        baseNonce: nonce,
        isRefilling: false,
        hasTriggeredRefill: false
      })




      console.log(`Pre-signed 10 transactions for MegaETH Testnet`)

    } catch (err) {
      console.error('Error initializing network:', err)
      setError(`Failed to initialize MegaETH Testnet: ${err.message}`)
    } finally {
      setIsInitializing(false)
    }
  }

  // Fixed execution with proper refill trigger
  const executeTransaction = async () => {
    if (!preSignedPool || preSignedPool.currentIndex >= preSignedPool.transactions.length) {
      setError('No pre-signed transactions available')
      return
    }

    setIsExecuting(true)
    setError('')
    setResult('')

    try {
      const { walletClient } = await getNetworkClient()
      if (!walletClient) throw new Error('Failed to create client')

      const signedTx = preSignedPool.transactions[preSignedPool.currentIndex]

      const startTime = performance.now()

      const result = await walletClient.request({
        //@ts-ignore
        method: 'realtime_sendRawTransaction',
        params: [signedTx],
      })


      const endTime = performance.now()
      const timeTaken = Math.round(endTime - startTime)
      console.log("result: ", result)


      setPreSignedPool(prev => {
        if (!prev) return null

        const newCurrentIndex = prev.currentIndex + 1

        // Refill every 5 transactions (50% of initial 10), but only once per batch
        if (newCurrentIndex % 5 === 0 && !prev.hasTriggeredRefill) {
          console.log(`🔔 Triggering refill at ${newCurrentIndex} transactions used`)
          setTimeout(() => extendPool(), 0)
          return {
            ...prev,
            currentIndex: newCurrentIndex,
            hasTriggeredRefill: true  // Only set this when we actually trigger refill
          }
        }

        return {
          ...prev,
          currentIndex: newCurrentIndex
        }
      })

      setResult(`Hash: ${result?.transactionHash}\nTime: ${timeTaken}ms`)
      setTransactionHistory(prev => [
        {
          network: selectedNetwork.name,
          hash: result?.transactionHash || 'N/A',
          time: timeTaken
        },
        ...prev.slice(0, 9) // Keep only last 10
      ])

    } catch (err) {
      console.error('❌ Error executing:', err)
      setError(err.message)
    } finally {
      setIsExecuting(false)
    }
  }

  const clearHistory = () => {
    setTransactionHistory([])
  }

  const availableTransactions = preSignedPool ? preSignedPool.transactions.length - preSignedPool.currentIndex : 0

  //isExecuting || isInitializing || !preSignedPool || availableTransactions === 0

  // Initialize network on mount
  useEffect(() => {
    const setup = async () => {
      if (!ready || !embeddedWallet) return

      try {
        await initializeNetwork()
      } catch (err) {
        console.error('Error initializing network:', err)
      }
    }

    setup()
  }, [ready, embeddedWallet])



  return ( authenticated && ready &&
    <div className="flex flex-col items-center text-center justify-start pt-28 p-8">
      <h3 className="text-4xl font-bold mb-2 text-black dark:text-white">
        Realtime Blockchain Endpoints
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-8 text-center max-w-2xl">
        Compare the performance of different blockchain networks&apos; realtime transaction endpoints
      </p>

      {/* Endpoint Highlight */}
      {selectedNetwork.id !== 'select' && (
        <div className="mb-8 p-6 border-2 border-dashed border-blue-500/30 rounded-xl bg-blue-500/5 max-w-lg text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap className="text-blue-500" size={20} />
            <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400">
              Realtime Endpoint
            </h3>
          </div>
          <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-blue-700 dark:text-blue-300">
            {selectedNetwork.endpoint}
          </code>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
            This endpoint is designed for ultra-low latency transaction submission
          </p>
        </div>
      )}

      {/* Initialization Status */}
      {isInitializing && (
        <div className="mb-6 flex items-center gap-2 text-blue-600 dark:text-blue-400">
          <Loader2 className="animate-spin" size={20} />
          <span>Pre-signing transactions for {selectedNetwork.name}...</span>
        </div>
      )}

      {/* Execute Button */}
      <div className="mb-8">
        <button
          onClick={executeTransaction}
          disabled={isExecuting || isInitializing || !preSignedPool || availableTransactions === 0 || selectedNetwork.id === 'select'}
          className="px-8 py-4 hover:cursor-pointer bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg transition-all duration-200 hover:scale-105"
        >
          {isExecuting ? (
            <>
              <Loader2 className="animate-spin inline mr-2" size={20} />
              Testing {selectedNetwork.name}...
            </>
          ) : (
            `Test ${selectedNetwork.name === "Select Network" ? "" : selectedNetwork.name} Endpoint`
          )}
        </button>
      </div>

      {result && (
        <div className="mb-6 p-4 bg-green-100 dark:bg-green-900 rounded-lg max-w-2xl">
          <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">
            ✅ Transaction Successful
          </h3>
          <div className="text-green-700 dark:text-green-300 space-y-2">
            {result.split('\n').map((line, index) => {
              if (line.startsWith('Hash:')) {
                const hash = line.replace('Hash: ', '')
                const getExplorerUrl = (networkId, hash) => {
                  switch (networkId) {
                    case 'megaeth': return `https://www.megaexplorer.xyz/tx/${hash}`
                    default: return '#'
                  }
                }

                return (
                  <div key={index}>
                    <span>Hash: </span>
                    <a
                      href={getExplorerUrl(selectedNetwork.id, hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 font-mono break-all"
                    >
                      {hash}
                    </a>
                  </div>
                )
              }
              return <p key={index}>{line}</p>
            })}
          </div>
        </div>
      )
      }

      {
        error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900 rounded-lg max-w-2xl">
            <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
              ❌ Error
            </h3>
            <p className="text-red-700 dark:text-red-300 break-all">
              {error}
            </p>
          </div>
        )
      }

      {/* Floating scroll indicator */}
      {transactionHistory.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-blue-600 text-white rounded-full p-3 shadow-lg hover:bg-blue-700 transition-all duration-200 cursor-pointer animate-pulse"
            onClick={() => {
              document.querySelector('.transaction-history-table')?.scrollIntoView({
                behavior: 'smooth'
              })
            }}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {transactionHistory.length} transaction{transactionHistory.length>1?"s":""}
              </span>
              <div className="text-lg">↓</div>
            </div>
          </div>
        </div>
      )}

      {/* Network Info */}
      {
        selectedNetwork.id !== 'select' && (
          <div className="mb-8 text-xs text-gray-500 dark:text-gray-400 text-center space-y-1">
            {/* <p>Contract: {CONTRACT_ADDRESSES}</p>*/}
            <p>Chain: {selectedNetwork.name} ({selectedNetwork.chainId})</p>
          </div>
        )
      }

      {/* Transaction History Table */}
      {transactionHistory.length > 0 && (
        <div className="w-full max-w-4xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Last {transactionHistory.length>1?transactionHistory.length:""} Transaction{transactionHistory.length>1?"s":""}
            </h3>
            <button
              onClick={clearHistory}
              className="text-sm hover:cursor-pointer text-gray-500 hover:text-red-500 transition-colors"
            >
              Clear History
            </button>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg">
            <table className="w-full transaction-history-table">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                    Network
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                    Hash
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {transactionHistory.map((tx, index) => {
                  const getExplorerUrl = (networkName, hash) => {
                    const networkId = networkName.toLowerCase().replace(' ', '')
                    switch (networkId) {
                      case 'megaeth': return `https://www.megaexplorer.xyz/tx/${hash}`
                      default: return '#'
                    }
                  }

                  return (
                    <tr key={`${tx.hash}-${index}`} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${tx.network === 'MegaETH' ? 'bg-amber-600' :
                            tx.network === 'RISE' ? 'bg-purple-500' : 'bg-green-500'
                            }`} />
                          <span className="text-gray-900 dark:text-gray-100 font-medium">{tx.network}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <a
                          href={getExplorerUrl(tx.network, tx.hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-mono text-xs hover:underline"
                        >
                          {tx.hash.slice(0, 8)}...{tx.hash.slice(-6)}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-gray-100">
                        <span className={`px-2 py-1 rounded-full text-xs ${tx.time < 200 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          tx.time < 500 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                          {tx.time}ms
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Scroll indicator for mobile */}
          <div className="flex justify-center mt-2 md:hidden">
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <span>←</span>
              <span>Scroll to see all columns</span>
              <span>→</span>
            </div>
          </div>
        </div>
      )}

    </div > 
  )
}