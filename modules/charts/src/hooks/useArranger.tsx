import { useDataContext } from "@overture-stack/arranger-components/dist/DataContext";
import { useThemeContext } from "@overture-stack/arranger-components/dist/ThemeContext";

export const useArranger = () => {
  const dataContext = useDataContext();
  const themeContext = useThemeContext();

  return { dataContext, themeContext };
};
