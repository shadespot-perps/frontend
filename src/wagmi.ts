import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { arbitrumSepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'ShadeSpot',
  projectId: 'YOUR_PROJECT_ID',
  chains: [arbitrumSepolia],
});
