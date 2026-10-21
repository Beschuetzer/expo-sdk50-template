import { Redirect } from 'expo-router';

import { Routes } from '@/constants/navigation';

export default function OAuthLogoutScreen() {
  return <Redirect href={`/${Routes.AccountScreen}`} />;
}
