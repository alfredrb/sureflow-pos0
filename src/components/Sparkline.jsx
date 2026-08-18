import { Sparklines, SparklinesLine, SparklinesBars, SparklinesReferenceLine } from "react-sparklines";

// Compact inline trend visualization built on react-sparklines.
// `data` is an array of numbers (one point per time bucket). Returns null
// when there isn't enough data to draw a meaningful line.
export default function Sparkline({ data = [], color = "#10b981", height = 24, width = 90, bars = false, showAvg = true }) {
  if (!Array.isArray(data) || data.length < 2) return null;
  return (
    <Sparklines data={data} width={width} height={height} svgWidth={width} svgHeight={height} preserveAspectRatio="xMidYMid meet">
      {/* react-sparklines clones every child, so falsy children crash it —
          build the child list instead of using inline conditionals. */}
      {[
        bars
          ? <SparklinesBars key="b" color={color} barWidth={3} />
          : <SparklinesLine key="l" color={color} lineWidth={1.5} style={{ fill: "none" }} />,
        ...(showAvg
          ? [<SparklinesReferenceLine key="avg" type="avg" style={{ stroke: "#cbd5e1", strokeOpacity: 0.6, strokeDasharray: "2,2" }} />]
          : []),
      ]}
    </Sparklines>
  );
}