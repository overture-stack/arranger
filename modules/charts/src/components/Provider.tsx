import { get } from "lodash";
import { createContext, useContext, useEffect, useState } from "react";
import { useArrangerData } from "@overture-stack/arranger-components";

import { useChartsQuery } from "../query/ChartQuery";

type ChartContextType = {
  theme: {};
  registerChart: () => void;
  deregisterChart: () => void;
  getChartData: () => void;
  update: () => void;
};

const ChartsContext = createContext<ChartContextType | null>(null);

type ChartsProviderProps = React.PropsWithChildren<{ theme: {} }>;

const resolveGQLResponse = ({ fieldName, documentType, gqlResponse }) => {
  return get(gqlResponse, ["data", documentType, "aggregations", fieldName]);
};

export const ChartsProvider: ChartsProviderProps = ({ theme, children }) => {
  const [fields, setFields] = useState([]);
  const [data, setData] = useState();
  const [isLoading, setLoading] = useState(false);

  const { apiFetcher, sqon, setSQON, documentType } = useArrangerData({
    callerName: "ArrangerCharts",
  });

  const chartsQuery = useChartsQuery({ documentType, fields });

  useEffect(() => {
    if (fields.length === 0) {
      return setData({});
    }
    const updateData = async () => {
      try {
        setLoading(true);
        const data = await apiFetcher({
          body: {
            query: chartsQuery.resolve(),
          },
        });
        console.log("fetcher result", data);
        setData(data);
      } catch (err) {
        console.log("err", err);
      } finally {
        setLoading(false);
      }
    };

    updateData();
  }, [fields, sqon, apiFetcher]);

  const chartContext = {
    theme,
    registerChart: async ({ fieldName }) => {
      // add to "query" really its a , register handlers, validate against api etc
      console.log("register", fieldName);
      // chartQuery.add(field);
      //console.log("cccqqq", chartQuery.resolve());
      setFields((fields) => fields.concat(fieldName));
    },

    deregisterChart: ({ fieldName }) => {
      console.log("deregisteer", fieldName);
      setFields((fields) => fields.filter(fieldName));
    },

    update: ({ fieldName, eventData }) => {
      console.log("update", fieldName, eventData);
      // new data => sqon => arranger => data => render
      // update arranger.setSqon
      setSQON();
    },

    // chartType for slicing data
    getChartData: ({ fieldName }) => {
      // slice, cache?, data transform
      console.log("getchartdata", fieldName);
      // Aggregation => Chart config
      const resolvedData =
        !isLoading &&
        resolveGQLResponse({ fieldName, documentType, gqlResponse: data });

      return {
        isLoading,
        isError: false,
        data: resolvedData,
      };
    },
  };

  return (
    <ChartsContext.Provider value={chartContext}>
      {children}
    </ChartsContext.Provider>
  );
};

export const useChartsContext = () => {
  const context = useContext(ChartsContext);
  if (!context) {
    throw new Error("context has to be used within <Charts.Provider>");
  }
  return context;
};
