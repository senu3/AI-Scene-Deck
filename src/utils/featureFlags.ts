function isEnvFlagEnabled(value: string | undefined): boolean {
  return value === '1';
}

export function isEnvironmentSettingsEnabled(): boolean {
  return isEnvFlagEnabled(import.meta.env.VITE_ENABLE_ENVIRONMENT_SETTINGS);
}

export function isVideoHoldEnabled(): boolean {
  return isEnvFlagEnabled(import.meta.env.VITE_ENABLE_VIDEO_HOLD);
}

export function isNotificationTestToolsEnabled(): boolean {
  return import.meta.env.DEV && isEnvironmentSettingsEnabled();
}
