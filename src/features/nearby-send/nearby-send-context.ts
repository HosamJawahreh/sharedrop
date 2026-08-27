import { createContext } from 'react'
import type { NearbySendController } from './types'

export const NearbySendContext = createContext<NearbySendController | null>(null)
