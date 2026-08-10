"use client";

import { CheckCircle2, Download, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useUpdater } from "@/lib/tauri/updater";

export default function SettingsPage() {
  const {
    status,
    currentVersion,
    update,
    progress,
    error,
    isSupported,
    checkForUpdates,
    installUpdate,
  } = useUpdater();
  const checking = status === "checking";
  const installing = status === "downloading" || status === "installing";

  return (
    <main className="mx-auto min-h-full w-full max-w-3xl px-6 pb-16 pt-24">
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Preferencias</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Configuración</h1>
      </div>

      <section aria-labelledby="updates-heading">
        <h2 id="updates-heading" className="mb-3 text-sm font-medium text-muted-foreground">
          Aplicación
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>Actualizaciones</CardTitle>
            <CardDescription>
              Versión {currentVersion}. Se buscan nuevas versiones automáticamente al iniciar.
            </CardDescription>
            <CardAction>
              {update && status === "available" ? (
                <Button onClick={() => void installUpdate()}>
                  <Download />
                  Instalar {update.version}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled={!isSupported || checking || installing}
                  onClick={() => void checkForUpdates(true)}
                >
                  {checking ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                  {checking ? "Buscando" : "Buscar actualizaciones"}
                </Button>
              )}
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3 border-t pt-4">
            <div className="flex items-start gap-3">
              {status === "up-to-date" ? (
                <CheckCircle2 className="mt-0.5 size-4 text-emerald-500" />
              ) : (
                <ShieldCheck className="mt-0.5 size-4 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">
                  {status === "up-to-date"
                    ? "Tienes la versión más reciente"
                    : status === "available"
                      ? `La versión ${update?.version} está disponible`
                      : status === "downloading"
                        ? `Descargando${progress === null ? "" : `: ${Math.round(progress)} %`}`
                        : status === "installing"
                          ? "Instalando actualización"
                          : status === "error"
                            ? "No se pudo comprobar la actualización"
                            : "Actualizaciones firmadas y verificadas"}
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  {error ??
                    (isSupported
                      ? "Los paquetes se descargan desde GitHub Releases y Tauri valida su firma antes de instalarlos."
                      : "Abre esta sección desde la aplicación de escritorio para buscar actualizaciones.")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
