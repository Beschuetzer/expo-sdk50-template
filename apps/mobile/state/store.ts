import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import devToolsEnhancer from 'redux-devtools-expo-dev-plugin';
import { persistStore, persistReducer } from 'redux-persist';

import generalReducer, { generalSlice } from '@/state/slices/generalSlice';
import { logWarn } from '@/utils/logging';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  version: 1,
  whitelist: [generalSlice.name],
  serialize: true,
  writeFailHandler: (error: Error) => {
    logWarn('redux_persist_write_failed', { error });
  },
  debug: false,
  throttle: 200,
};

const rootReducer = combineReducers({
  [generalSlice.name]: generalReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

const REDUX_PERSIST_IGNORE_ACTIONS = [
  'persist/FLUSH',
  'persist/PAUSE',
  'persist/PERSIST',
  'persist/PURGE',
  'persist/REGISTER',
  'persist/REHYDRATE',
];

export const store = configureStore({
  reducer: persistedReducer,
  devTools: false,
  enhancers: (getDefaultEnhancers) =>
    __DEV__
      ? getDefaultEnhancers().concat(devToolsEnhancer())
      : getDefaultEnhancers(),
  middleware: (getDefaultMiddleware) => {
    return getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: REDUX_PERSIST_IGNORE_ACTIONS,
      },
    });
  },
});

export const persistor = persistStore(store);

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;

// app/hooks.ts

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
