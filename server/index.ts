import { startSignalingServer } from './signaling-server.js'
import { buildDevServerUrls, formatDevStartupBanner } from './lan-addresses.js'
import { loadConfig } from './config.js'

if (!process.env.SHAREDROP_DEV_ALL) {
  const config = loadConfig()
  console.log(formatDevStartupBanner(buildDevServerUrls(5173, config.port)))
}

startSignalingServer()
