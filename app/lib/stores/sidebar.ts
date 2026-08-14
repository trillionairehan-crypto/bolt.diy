import { atom } from 'nanostores';

export const sidebarOpenStore = atom<boolean>(false);

export const setSidebarOpen = (open: boolean) => {
  sidebarOpenStore.set(open);
};

export const toggleSidebar = () => {
  sidebarOpenStore.set(!sidebarOpenStore.get());
};
