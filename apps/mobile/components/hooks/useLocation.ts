import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type UseLocationOptions = Location.LocationOptions & {
  autoStart?: boolean;
  watch?: boolean;
};

export type UseLocationResult = {
  error: Error | null;
  getCurrentLocation: () => Promise<Location.LocationObject | null>;
  isLoading: boolean;
  isWatching: boolean;
  location: Location.LocationObject | null;
  permission: Location.LocationPermissionResponse | null;
  requestPermission: () => Promise<Location.LocationPermissionResponse>;
  startWatching: () => Promise<boolean>;
  stopWatching: () => void;
};

export function useLocation({
  autoStart = false,
  accuracy,
  distanceInterval,
  mayShowUserSettingsDialog,
  timeInterval,
  watch = false,
}: UseLocationOptions = {}): UseLocationResult {
  const locationOptions = useMemo(
    () => ({
      accuracy,
      distanceInterval,
      mayShowUserSettingsDialog,
      timeInterval,
    }),
    [accuracy, distanceInterval, mayShowUserSettingsDialog, timeInterval],
  );
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [permission, setPermission] =
    useState<Location.LocationPermissionResponse | null>(null);
  const permissionRef = useRef<Location.LocationPermissionResponse | null>(
    null,
  );
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const isMountedRef = useRef(true);

  const requestPermission = useCallback(async () => {
    const response = await Location.requestForegroundPermissionsAsync();
    if (isMountedRef.current) {
      permissionRef.current = response;
      setPermission(response);
      if (!response.granted) {
        setError(new Error('Foreground location permission was denied.'));
      }
    }
    return response;
  }, []);

  const getCurrentLocation = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const permissionResponse =
        permissionRef.current?.granted === true
          ? permissionRef.current
          : await requestPermission();

      if (!permissionResponse.granted) {
        return null;
      }

      const nextLocation =
        await Location.getCurrentPositionAsync(locationOptions);
      if (isMountedRef.current) {
        setLocation(nextLocation);
      }
      return nextLocation;
    } catch (nextError) {
      const normalizedError =
        nextError instanceof Error
          ? nextError
          : new Error('Unable to get the current location.');
      if (isMountedRef.current) {
        setError(normalizedError);
      }
      return null;
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [locationOptions, requestPermission]);

  const stopWatching = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    if (isMountedRef.current) {
      setIsWatching(false);
    }
  }, []);

  const startWatching = useCallback(async () => {
    stopWatching();
    setError(null);

    try {
      const permissionResponse =
        permissionRef.current?.granted === true
          ? permissionRef.current
          : await requestPermission();

      if (!permissionResponse.granted) {
        return false;
      }

      const subscription = await Location.watchPositionAsync(
        locationOptions,
        (nextLocation) => {
          if (isMountedRef.current) {
            setLocation(nextLocation);
          }
        },
      );
      subscriptionRef.current = subscription;
      if (isMountedRef.current) {
        setIsWatching(true);
      } else {
        subscription.remove();
      }
      return true;
    } catch (nextError) {
      if (isMountedRef.current) {
        setError(
          nextError instanceof Error
            ? nextError
            : new Error('Unable to watch the current location.'),
        );
      }
      return false;
    }
  }, [locationOptions, requestPermission, stopWatching]);

  useEffect(() => {
    isMountedRef.current = true;

    if (autoStart) {
      if (watch) {
        startWatching();
      } else {
        getCurrentLocation();
      }
    }

    return () => {
      isMountedRef.current = false;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [autoStart, getCurrentLocation, startWatching, watch]);

  return {
    error,
    getCurrentLocation,
    isLoading,
    isWatching,
    location,
    permission,
    requestPermission,
    startWatching,
    stopWatching,
  };
}
