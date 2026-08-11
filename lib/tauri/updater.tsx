"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { Download, LoaderCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { isTauriContext } from "@/lib/env";
import { useAppSettings } from "@/lib/settings";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "installing"
  | "error";

interface UpdateInfo {
  version: string;
  currentVersion: string;
  date?: string;
  body?: string;
}

interface UpdaterContextValue {
  status: UpdateStatus;
  currentVersion: string;
  update: UpdateInfo | null;
  progress: number | null;
  error: string | null;
  isSupported: boolean;
  checkForUpdates: (manual?: boolean) => Promise<void>;
  installUpdate: () => Promise<void>;
}

const UpdaterContext = createContext<UpdaterContextValue | null>(null);
let automaticCheckStarted = false;

function subscribeToTauriContext() {
  return () => {};
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function UpdateProvider({ children }: { children: ReactNode }) {
  const { settings, isLoaded: settingsLoaded } = useAppSettings();
  const supported = useSyncExternalStore(
    subscribeToTauriContext,
    isTauriContext,
    () => false,
  );
  const updateRef = useRef<Update | null>(null);
  const operationRef = useRef(false);
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [currentVersion, setCurrentVersion] = useState("0.1.0");
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!supported) return;
    void getVersion().then(setCurrentVersion).catch(console.error);
  }, [supported]);

  const checkForUpdates = useCallback(
    async (manual = true) => {
      if (!supported) {
        if (manual) toast.info("Las actualizaciones solo están disponibles en la app de escritorio.");
        return;
      }
      if (operationRef.current) return;

      operationRef.current = true;
      setStatus("checking");
      setError(null);

      try {
        const available = await check({ timeout: 30_000 });
        if (!available) {
          if (updateRef.current) await updateRef.current.close();
          updateRef.current = null;
          setUpdate(null);
          setStatus("up-to-date");
          if (manual) toast.success("Spotify Rework está actualizado.");
          return;
        }

        if (updateRef.current) await updateRef.current.close();
        updateRef.current = available;
        setCurrentVersion(available.currentVersion);
        setUpdate({
          version: available.version,
          currentVersion: available.currentVersion,
          date: available.date,
          body: available.body,
        });
        setStatus("available");
        if (manual) {
          setDialogOpen(true);
        } else {
          setStatus("downloading");
          setProgress(0);
          let downloaded = 0;
          let total: number | undefined;

          await available.downloadAndInstall((event) => {
            if (event.event === "Started") {
              total = event.data.contentLength;
              setProgress(total ? 0 : null);
            } else if (event.event === "Progress") {
              downloaded += event.data.chunkLength;
              setProgress(total ? Math.min(100, (downloaded / total) * 100) : null);
            } else {
              setProgress(100);
              setStatus("installing");
            }
          });

          setStatus("installing");
          await relaunch();
        }
      } catch (caught) {
        const message = errorMessage(caught);
        setError(message);
        setStatus("error");
        if (manual) toast.error("No se pudo buscar actualizaciones", { description: message });
        else console.error("Automatic update check failed:", caught);
      } finally {
        operationRef.current = false;
      }
    },
    [supported],
  );

  const installUpdate = useCallback(async () => {
    const available = updateRef.current;
    if (!available || operationRef.current) return;

    operationRef.current = true;
    setDialogOpen(true);
    setStatus("downloading");
    setProgress(0);
    setError(null);
    let downloaded = 0;
    let total: number | undefined;

    try {
      await available.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength;
          setProgress(total ? 0 : null);
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setProgress(total ? Math.min(100, (downloaded / total) * 100) : null);
        } else {
          setProgress(100);
          setStatus("installing");
        }
      });

      setStatus("installing");
      await relaunch();
    } catch (caught) {
      const message = errorMessage(caught);
      setError(message);
      setStatus("error");
      toast.error("No se pudo instalar la actualización", { description: message });
    } finally {
      operationRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (
      !settingsLoaded ||
      !settings.updates.automaticChecks ||
      !supported ||
      automaticCheckStarted
    ) {
      return;
    }
    automaticCheckStarted = true;
    let checkStarted = false;

    const timer = window.setTimeout(() => {
      checkStarted = true;
      if (getCurrentWindow().label === "main") void checkForUpdates(false);
    }, 4_000);

    return () => {
      window.clearTimeout(timer);
      if (!checkStarted) automaticCheckStarted = false;
    };
  }, [
    checkForUpdates,
    settings.updates.automaticChecks,
    settingsLoaded,
    supported,
  ]);

  const value = useMemo<UpdaterContextValue>(
    () => ({
      status,
      currentVersion,
      update,
      progress,
      error,
      isSupported: supported,
      checkForUpdates,
      installUpdate,
    }),
    [status, currentVersion, update, progress, error, supported, checkForUpdates, installUpdate],
  );

  const busy = status === "downloading" || status === "installing";

  return (
    <UpdaterContext.Provider value={value}>
      {children}
      <AlertDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!busy) setDialogOpen(open);
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogMedia>
              {busy ? <LoaderCircle className="animate-spin" /> : <Download />}
            </AlertDialogMedia>
            <AlertDialogTitle>
              {status === "downloading"
                ? "Descargando actualización"
                : status === "installing"
                  ? "Instalando y reiniciando"
                  : status === "error"
                    ? "No se pudo actualizar"
                    : `Spotify Rework ${update?.version ?? ""}`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {status === "available" && (
                  <>
                    <p>Hay una nueva versión disponible para instalar.</p>
                    {update?.body && (
                      <p className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-left">
                        {update.body}
                      </p>
                    )}
                  </>
                )}
                {status === "downloading" && (
                  <p>{progress === null ? "Descargando…" : `${Math.round(progress)} % completado`}</p>
                )}
                {status === "installing" && <p>La actualización está lista. La aplicación se reiniciará.</p>}
                {status === "error" && <p>{error}</p>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {status === "downloading" && (
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full bg-primary transition-[width] ${progress === null ? "w-1/3 animate-pulse" : ""}`}
                style={progress === null ? undefined : { width: `${progress}%` }}
              />
            </div>
          )}

          {!busy && (
            <AlertDialogFooter>
              <AlertDialogCancel>Ahora no</AlertDialogCancel>
              <Button onClick={() => void installUpdate()}>
                {status === "error" ? <RefreshCw /> : <Download />}
                {status === "error" ? "Reintentar" : "Descargar e instalar"}
              </Button>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </UpdaterContext.Provider>
  );
}

export function useUpdater() {
  const context = useContext(UpdaterContext);
  if (!context) throw new Error("useUpdater must be used within UpdateProvider");
  return context;
}
