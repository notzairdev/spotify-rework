import { getCurrentWindow } from "@tauri-apps/api/window";

async function handleMinimize() {
  const appWindow = getCurrentWindow();
  await appWindow?.minimize();
}

async function handleMaximize() {
  const appWindow = getCurrentWindow();
  const isMaximized = await appWindow.isMaximized();

  if (isMaximized) {
    await appWindow.unmaximize();
  } else {
    await appWindow.maximize();
  }
}

async function handleClose() {
  const appWindow = getCurrentWindow();
  await appWindow?.close();
}

async function handleDestroy() {
  const appWindow = getCurrentWindow();
  await appWindow?.destroy();
}

async function startDragging() {
  const appWindow = getCurrentWindow();
  await appWindow?.startDragging();
}

const WINDOW_CONTROLS = {
  handleMinimize,
  handleMaximize,
  handleClose,
  handleDestroy,
  startDragging,
};

export const useWindow = () => WINDOW_CONTROLS;
