import { startSignalingServer } from './signaling-server.js'
import { buildDevServerUrls, formatDevStartupBanner } from './lan-addresses.js'
import { isProductionEnv, loadConfig } from './config.js'

if (!process.env.SHAREDROP_DEV_ALL && !isProductionEnv()) {
  const config = loadConfig()
  console.log(formatDevStartupBanner(buildDevServerUrls(5173, config.port)))
}

startSignalingServer()
