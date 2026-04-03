// 020-contractual-document — Barrel export

export { generateContractualDocument } from './contractual-document.service'
export { generateReferenceNumber, isValidReferenceNumber } from './reference-generator'
export type {
  ContractualDocument,
  Article,
  GenerationStats,
  CorrespondenceRow,
  ScopeData,
  SignatureBlockData,
} from './types'
