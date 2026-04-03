// 018-rule-description-engine — Public barrel export

export type {
  DescriptionRequest,
  DescriptionBatch,
  RuleDescription,
  DescriptionSource,
  ValueEquivalenceInput,
} from './types'

export { generateDescriptions } from './rule-description.service'
export { describePROMPT } from './llm-client'
export { describeValueEquivalence, describeInformational, describeError, describeUnknown } from './templates'
