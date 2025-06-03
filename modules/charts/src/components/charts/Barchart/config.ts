import { merge } from "lodash";

export const defaultConfig = {
  layout: "horizontal",
  padding: 0.3,
  valueScale: { type: "linear" },
  colors: { scheme: "paired" },
  borderColor: { from: "color", modifiers: [["darker", 1.6]] },
  axisTop: null,
  axisRight: null,
  animate: false,
  enableGridX: false,
  enableGridY: false,
  enableLabel: false,
  axisBottom: {
    legend: "Axis-Bottom-Legend",
    legendPosition: "middle",
    tickValues: 4,
    legendOffset: 34,
  },
  axisLeft: {
    legend: "Axis-Left-Legend",
    legendPosition: "middle",
    renderTick: () => null,
    legendOffset: -12,
  },

  margin: {
    top: 12,
    right: 24,
    left: 24,
    bottom: 56,
  },

  indexBy: "key",
  keys: ["doc_count"],

  colorBy: "indexValue",

  onClick: (data) => {
    console.log("data", data);
  },
};

type AllowedOverrides = "layout";

const resolveConfig = (props: AllowedOverrides) => {
  const result = merge(defaultConfig, props);
  console.log("r", result);
  return result;
};
