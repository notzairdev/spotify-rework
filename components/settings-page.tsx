"use client";

import type { ReactNode } from "react";
import {
  CheckCircle2,
  AppWindow,
  Database,
  Download,
  LayoutPanelLeft,
  LoaderCircle,
  MonitorCog,
  MoonStar,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { clearStoredSearchHistory } from "@/lib/search-history";
import {
  useAppSettings,
  type CloseBehavior,
  type MinimizeBehavior,
  type NowPlayingWidth,
  type PreviousButtonBehavior,
  type ThemePreference,
} from "@/lib/settings";
import { clearSpotifyQueryCache, useSpotifyPlayer } from "@/lib/spotify";
import { useUpdater } from "@/lib/tauri/updater";
import { cn } from "@/lib/utils";

function saveSetting(request: Promise<void>) {
  void request.catch((reason: unknown) => {
    toast.error("Could not save this setting", {
      description: reason instanceof Error ? reason.message : String(reason),
    });
  });
}

export function SettingsPage() {
  const {
    status,
    error: settingsError,
    isNativeStorage,
  } = useAppSettings();

  return (
    <main className="relative mx-auto w-full max-w-[78rem] px-5 pb-40 pt-24 sm:px-7 lg:px-8 animate-fade-in">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.09),transparent_62%)]" />

      <header className="relative flex flex-col gap-6 pb-10 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
            <SlidersHorizontal className="size-3.5" />
            Preferences
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Settings</h1>
        </div>
        <SettingsSaveState
          status={status}
          error={settingsError}
          isNativeStorage={isNativeStorage}
        />
      </header>

      <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-7">
          <AppearanceSettingsSection />

          <LayoutSettingsSection />

          <PlaybackSettingsSection />
        </div>

        <div className="space-y-7">
          <WindowSettingsSection />
          <PrivacySettingsSection />
          <UpdatesSection />
          <ResetSettingsCard />
        </div>
      </div>
    </main>
  );
}

function AppearanceSettingsSection() {
  const { settings, updateSettings } = useAppSettings();

  return (
    <SettingsSection
      eyebrow="Look and feel"
      title="Appearance"
      icon={<MoonStar className="size-4" />}
    >
      <SettingRow
        title="Theme"
        description="Use the app palette or follow the operating system."
        control={(
          <Select
            value={settings.appearance.theme}
            onValueChange={(value) => saveSetting(updateSettings("appearance", {
              theme: value as ThemePreference,
            }))}
          >
            <SelectTrigger className="h-9 w-32 rounded-full border-border/70 bg-background/30 px-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        )}
      />
      <SettingRow
        title="Reduce motion"
        description="Minimize transitions, animated artwork, and decorative movement."
        control={(
          <Switch
            checked={settings.appearance.reduceMotion}
            onCheckedChange={(checked) => saveSetting(updateSettings("appearance", {
              reduceMotion: checked,
            }))}
            aria-label="Reduce motion"
          />
        )}
      />
      <SettingRow
        title="Reduce transparency"
        description="Replace translucent glass surfaces with solid backgrounds."
        control={(
          <Switch
            checked={settings.appearance.reduceTransparency}
            onCheckedChange={(checked) => saveSetting(updateSettings("appearance", {
              reduceTransparency: checked,
            }))}
            aria-label="Reduce transparency"
          />
        )}
      />
    </SettingsSection>
  );
}

function LayoutSettingsSection() {
  const { settings, updateSettings } = useAppSettings();

  return (
    <SettingsSection
      eyebrow="Workspace"
      title="Layout"
      icon={<LayoutPanelLeft className="size-4" />}
    >
      <SettingRow
        title="Show library sidebar"
        description="Keep your collection available beside the current page."
        control={(
          <Switch
            checked={settings.interface.showLibrarySidebar}
            onCheckedChange={(checked) => saveSetting(updateSettings("interface", {
              showLibrarySidebar: checked,
            }))}
            aria-label="Show library sidebar"
          />
        )}
      />
      <SettingRow
        title="Expanded library sidebar"
        description="Keep playlist names visible instead of showing artwork only."
        control={(
          <Switch
            checked={settings.interface.librarySidebarExpanded}
            disabled={!settings.interface.showLibrarySidebar}
            onCheckedChange={(checked) => saveSetting(updateSettings("interface", {
              librarySidebarExpanded: checked,
            }))}
            aria-label="Expanded library sidebar"
          />
        )}
      />
      <SettingRow
        title="Show Now Playing"
        description="Open the right-hand details panel whenever a track is loaded."
        control={(
          <Switch
            checked={settings.interface.showNowPlayingPanel}
            onCheckedChange={(checked) => saveSetting(updateSettings("interface", {
              showNowPlayingPanel: checked,
            }))}
            aria-label="Show Now Playing panel"
          />
        )}
      />
      <SettingRow
        title="Now Playing width"
        description="Choose how much horizontal space the track details panel uses."
        control={(
          <Select
            value={settings.interface.nowPlayingWidth}
            disabled={!settings.interface.showNowPlayingPanel}
            onValueChange={(value) => saveSetting(updateSettings("interface", {
              nowPlayingWidth: value as NowPlayingWidth,
            }))}
          >
            <SelectTrigger className="h-9 w-36 rounded-full border-border/70 bg-background/30 px-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="compact">Compact</SelectItem>
              <SelectItem value="comfortable">Comfortable</SelectItem>
              <SelectItem value="wide">Wide</SelectItem>
            </SelectContent>
          </Select>
        )}
      />
    </SettingsSection>
  );
}

function PlaybackSettingsSection() {
  const { settings, updateSettings } = useAppSettings();
  const { isReady, setVolume } = useSpotifyPlayer();

  const updateStartupVolume = async (values: number[]) => {
    const volume = (values[0] ?? 50) / 100;
    await updateSettings("playback", { startupVolume: volume });
    if (!isReady) return;
    try {
      await setVolume(volume);
    } catch (reason: unknown) {
      toast.error("The volume was saved for next launch", {
        description: reason instanceof Error ? reason.message : undefined,
      });
    }
  };

  return (
    <SettingsSection
      eyebrow="Listening"
      title="Playback"
      icon={<Volume2 className="size-4" />}
    >
      <div className="px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-sm font-medium">Startup volume</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Also remembers the latest non-muted volume from the player.
            </p>
          </div>
          <span className="rounded-full bg-muted/65 px-2.5 py-1 font-mono text-[11px] tabular-nums text-muted-foreground">
            {Math.round(settings.playback.startupVolume * 100)}%
          </span>
        </div>
        <Slider
          key={settings.playback.startupVolume}
          defaultValue={[Math.round(settings.playback.startupVolume * 100)]}
          min={5}
          max={100}
          step={1}
          onValueCommit={(values) => saveSetting(updateStartupVolume(values))}
          aria-label="Startup volume"
          className="mt-5"
          trackClassName="h-1.5"
          thumbClassName="size-4 rounded-full"
        />
      </div>
      <SettingRow
        title="Remember volume changes"
        description="Use your latest non-muted volume the next time the app opens."
        control={(
          <Switch
            checked={settings.playback.rememberVolume}
            onCheckedChange={(checked) => saveSetting(updateSettings("playback", {
              rememberVolume: checked,
            }))}
            aria-label="Remember volume changes"
          />
        )}
      />
      <SettingRow
        title="Activate this playback device automatically"
        description="Move Spotify playback here when the local player becomes ready."
        control={(
          <Switch
            checked={settings.playback.autoTransferPlayback}
            onCheckedChange={(checked) => saveSetting(updateSettings("playback", {
              autoTransferPlayback: checked,
            }))}
            aria-label="Activate this playback device automatically"
          />
        )}
      />
      <SettingRow
        title="Previous button"
        description="Restart after three seconds, or always move to the previous track."
        control={(
          <Select
            value={settings.playback.previousButtonBehavior}
            onValueChange={(value) => saveSetting(updateSettings("playback", {
              previousButtonBehavior: value as PreviousButtonBehavior,
            }))}
          >
            <SelectTrigger className="h-9 w-36 rounded-full border-border/70 bg-background/30 px-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="smart">Restart first</SelectItem>
              <SelectItem value="previous">Always previous</SelectItem>
            </SelectContent>
          </Select>
        )}
      />
    </SettingsSection>
  );
}

function PrivacySettingsSection() {
  const { settings, updateSettings } = useAppSettings();

  return (
    <SettingsSection
      eyebrow="On this device"
      title="Privacy & storage"
      icon={<ShieldCheck className="size-4" />}
    >
      <SettingRow
        title="Save recent searches"
        description="Keep up to eight search terms locally for quick access."
        control={(
          <Switch
            checked={settings.privacy.saveSearchHistory}
            onCheckedChange={(checked) => {
              if (!checked) clearStoredSearchHistory();
              saveSetting(updateSettings("privacy", { saveSearchHistory: checked }));
            }}
            aria-label="Save recent searches"
          />
        )}
      />
      <SettingRow
        title="Save playback snapshot"
        description="Let the desktop mini player restore the last known track state locally."
        control={(
          <Switch
            checked={settings.privacy.savePlaybackState}
            onCheckedChange={(checked) => saveSetting(updateSettings("privacy", {
              savePlaybackState: checked,
            }))}
            aria-label="Save playback snapshot"
          />
        )}
      />
      <SettingAction
        icon={<Search className="size-4" />}
        title="Clear recent searches"
        description="Remove every saved search term from this device."
        actionLabel="Clear"
        onClick={() => {
          clearStoredSearchHistory();
          toast.success("Search history cleared");
        }}
      />
      <SettingAction
        icon={<Database className="size-4" />}
        title="Refresh stored content"
        description="Discard temporary Spotify data and load it again as you browse."
        actionLabel="Refresh"
        onClick={() => {
          clearSpotifyQueryCache();
          toast.success("Stored content cleared");
        }}
      />
    </SettingsSection>
  );
}

function WindowSettingsSection() {
  const { settings, updateSettings } = useAppSettings();

  return (
    <SettingsSection
      eyebrow="Desktop behavior"
      title="Window controls"
      icon={<AppWindow className="size-4" />}
    >
      <SettingRow
        title="Minimize button"
        description="Keep the app in the taskbar or replace it with playback controls."
        control={(
          <Select
            value={settings.windowBehavior.minimizeBehavior}
            onValueChange={(value) => saveSetting(updateSettings("windowBehavior", {
              minimizeBehavior: value as MinimizeBehavior,
            }))}
          >
            <SelectTrigger className="h-9 w-40 rounded-full border-border/70 bg-background/30 px-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="dynamicIsland">Dynamic Island</SelectItem>
              <SelectItem value="taskbar">Taskbar</SelectItem>
            </SelectContent>
          </Select>
        )}
      />
      <SettingRow
        title="Close button"
        description="Exit completely or hide every window while playback continues in the tray."
        control={(
          <Select
            value={settings.windowBehavior.closeBehavior}
            onValueChange={(value) => saveSetting(updateSettings("windowBehavior", {
              closeBehavior: value as CloseBehavior,
            }))}
          >
            <SelectTrigger className="h-9 w-40 rounded-full border-border/70 bg-background/30 px-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="exit">Exit application</SelectItem>
              <SelectItem value="tray">Hide to tray</SelectItem>
            </SelectContent>
          </Select>
        )}
      />
    </SettingsSection>
  );
}

function ResetSettingsCard() {
  const { resetSettings } = useAppSettings();

  const resetAllSettings = async () => {
    try {
      await resetSettings();
      toast.success("Settings restored to defaults");
    } catch (reason: unknown) {
      toast.error("Could not reset settings", {
        description: reason instanceof Error ? reason.message : String(reason),
      });
    }
  };

  return (
    <section className="rounded-4xl border border-border/70 bg-card/55 p-6 shadow-lg shadow-black/5 backdrop-blur-xl">
      <div className="flex items-start gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted/65 text-muted-foreground">
          <RotateCcw className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Reset preferences</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Restore appearance, layout, playback, privacy, and update defaults. Your account and library stay untouched.
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        className="mt-5 w-full rounded-full border-border/80"
        onClick={() => void resetAllSettings()}
      >
        Restore defaults
      </Button>
    </section>
  );
}

function SettingsSection({
  eyebrow,
  title,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-4xl border border-border/70 bg-card/65 shadow-lg shadow-black/5 backdrop-blur-xl">
      <header className="flex items-end justify-between gap-4 px-5 py-5 sm:px-6">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">{title}</h2>
        </div>
        <span className="flex size-9 items-center justify-center rounded-xl bg-muted/65 text-muted-foreground">
          {icon}
        </span>
      </header>
      <div className="divide-y divide-border/70 border-t border-border/70">{children}</div>
    </section>
  );
}

function SettingRow({
  title,
  description,
  control,
}: {
  title: string;
  description: string;
  control: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4 sm:px-6">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function SettingAction({
  icon,
  title,
  description,
  actionLabel,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-5 px-5 py-4 sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button variant="ghost" size="sm" className="shrink-0 rounded-full" onClick={onClick}>
        {actionLabel}
      </Button>
    </div>
  );
}

function SettingsSaveState({
  status,
  error,
  isNativeStorage,
}: {
  status: "loading" | "saved" | "saving" | "error";
  error: string | null;
  isNativeStorage: boolean;
}) {
  const isBusy = status === "loading" || status === "saving";
  return (
    <div
      className={cn(
        "flex max-w-sm items-center gap-3 rounded-full border border-border/70 bg-card/65 px-4 py-2.5 text-xs text-muted-foreground backdrop-blur-xl",
        status === "error" && "border-destructive/25 text-destructive",
      )}
      title={error ?? undefined}
    >
      {isBusy ? (
        <LoaderCircle className="size-3.5 animate-spin" />
      ) : status === "error" ? (
        <ShieldCheck className="size-3.5" />
      ) : (
        <CheckCircle2 className="size-3.5 text-emerald-500" />
      )}
      <span>
        {status === "loading"
          ? "Loading preferences"
          : status === "saving"
            ? "Saving locally"
            : status === "error"
              ? "Settings could not be saved"
              : isNativeStorage
                ? "Preferences saved"
                : "Browser preview · saved locally"}
      </span>
    </div>
  );
}

function UpdatesSection() {
  const updater = useUpdater();
  const { settings, updateSettings } = useAppSettings();
  const checking = updater.status === "checking";
  const installing = updater.status === "downloading" || updater.status === "installing";
  const action = updater.update && updater.status === "available" ? (
    <Button className="rounded-full" onClick={() => void updater.installUpdate()}>
      <Download />
      Install {updater.update.version}
    </Button>
  ) : (
    <Button
      variant="outline"
      className="rounded-full"
      disabled={!updater.isSupported || checking || installing}
      onClick={() => void updater.checkForUpdates(true)}
    >
      {checking ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
      {checking ? "Checking" : "Check now"}
    </Button>
  );

  return (
    <SettingsSection eyebrow="Desktop client" title="Updates" icon={<MonitorCog className="size-4" />}>
      <div className="px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Version {updater.currentVersion}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {getUpdateMessage(updater)}
            </p>
          </div>
          {action}
        </div>
        {installing && updater.progress !== null && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{updater.status === "installing" ? "Installing" : "Downloading"}</span>
              <span className="font-mono tabular-nums">{Math.round(updater.progress)}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-foreground" style={{ width: `${updater.progress}%` }} />
            </div>
          </div>
        )}
      </div>
      <SettingRow
        title="Automatic updates"
        description="Keep Spotify Rework up to date in the background."
        control={(
          <Switch
            checked={settings.updates.automaticChecks}
            onCheckedChange={(checked) => saveSetting(updateSettings("updates", {
              automaticChecks: checked,
            }))}
            aria-label="Check for updates automatically"
          />
        )}
      />
    </SettingsSection>
  );
}

function getUpdateMessage(updater: ReturnType<typeof useUpdater>): string {
  if (updater.error) return updater.error;
  switch (updater.status) {
    case "up-to-date":
      return "Spotify Rework is up to date.";
    case "available":
      return `Version ${updater.update?.version} is ready to install.`;
    case "downloading":
      return "Downloading the update.";
    case "installing":
      return "Installing the update. The app will restart when it is ready.";
    case "error":
      return "The update service could not be reached.";
    default:
      return updater.isSupported
        ? "Updates are checked in the background."
        : "Open this page in the desktop app to manage updates.";
  }
}
