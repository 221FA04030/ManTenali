import { createContext, useContext, useMemo, useState } from 'react';

const MenuContext = createContext({ open: false, openMenu: () => {}, closeMenu: () => {} });

export function MenuProvider({ children }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(
    () => ({ open, openMenu: () => setOpen(true), closeMenu: () => setOpen(false) }),
    [open],
  );
  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export const useMenu = () => useContext(MenuContext);
