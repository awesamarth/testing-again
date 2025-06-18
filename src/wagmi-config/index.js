import { megaethTestnet } from 'viem/chains';
import { http } from 'wagmi';
import { createConfig } from '@privy-io/wagmi';

// Replace these with your app's chains

export const wagmiConfig = createConfig({
  chains: [megaethTestnet],
  transports: {
    [megaethTestnet.id]: http()
  },
});