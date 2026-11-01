export enum Routes {
  AccountScreen = 'AccountScreen',
  DashboardScreen = 'index',
}

export const AppRoutePaths = {
  home: '/(tabs)/(home)',
  searchRelationships: '/search-relationships',
  money: '/(tabs)/(requests)',
  viewAllRequests: '/(tabs)/(requests)/ViewAllRequestsScreen',
  createRequest: '/(tabs)/(requests)/NewPaymentRequestScreen',
  awaitingDecision: '/(tabs)/(requests)/AwaitingDecisionScreen',
  viewJointAccountCharges: '/(tabs)/(requests)/JointAccountChargesScreen',
  createJointAccountCharge: '/(tabs)/(requests)/NewJointAccountChargeScreen',
  rules: '/(tabs)/(rules)',
  viewAllRules: '/(tabs)/(rules)/ViewAllRulesScreen',
  createRule: '/(tabs)/(rules)/NewRelationshipRuleScreen',
  account: '/AccountScreen',
  settings: '/settings',
} as const;
