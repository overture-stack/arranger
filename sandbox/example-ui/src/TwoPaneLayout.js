import React from 'react'
import ReactGridLayout, { WidthProvider } from 'react-grid-layout'
const ResponsiveReactGridLayout = WidthProvider(ReactGridLayout)

export default ({
  layout = [
    { i: 'left', x: 0, y: 0, w: 3, h: 1, static: true },
    { i: 'right', x: 3, y: 0, w: 9, h: 1, static: true },
  ],
}) => {
  return (
    <ResponsiveReactGridLayout
      className="layout"
      layout={layout}
      cols={12}
      margin={[0, 0]}
      rowHeight={window.innerHeight}
      width={window.innerWidth}
    >
      <div key="left">left</div>
      <div key="right">right</div>
    </ResponsiveReactGridLayout>
  )
}
