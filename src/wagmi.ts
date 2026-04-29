import { createConfig, http } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

export const config = createConfig({
  chains: [arbitrumSepolia],
  connectors: [
    injected({
      target: 'metaMask',
      shimDisconnect: true,
    }),
    injected({
      shimDisconnect: true,
    }),
  ],
  transports: {
    [arbitrumSepolia.id]: http(),
  },
});
