import { getCurrentWindow } from "@tauri-apps/api/window";

export const useWindow = () => {
  const handleMinimize = async () => {
    const appWindow = getCurrentWindow();
    await appWindow?.minimize();
  };

  const handleMaximize = async () => {
    const appWindow = getCurrentWindow();
    const isMaximized = await appWindow.isMaximized();

    if (isMaximized) {
      await appWindow.unmaximize();
    } else {
      await appWindow.maximize();
    }
  };

  const handleClose = async () => {
    const appWindow = getCurrentWindow();
    await appWindow?.close();
  };

  const handleDestroy = async () => {
    const appWindow = getCurrentWindow();
    await appWindow?.destroy();
  };

  const startDragging = async () => {
    const appWindow = getCurrentWindow();
    await appWindow?.startDragging();
  };

  return {
    handleMinimize,
    handleMaximize,
    handleClose,
    handleDestroy,
    startDragging,
  };
};