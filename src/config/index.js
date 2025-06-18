import { megaethTestnet } from 'viem/chains'

// Get appId from Privy.io dashboard
export const appId = process.env.NEXT_PUBLIC_APP_ID || "" // replace with your actual appId

if (!appId) {
  throw new Error('App ID is not defined')
}

export const megaeth = megaethTestnet 
