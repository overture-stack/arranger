import { css } from 'emotion';

export default ({ scrollbarSize: { scrollbarWidth } } = {}) => css`
  &.ReactTable .rt-thead.-header {
    padding-right: ${scrollbarWidth}px;
  }
  &.ReactTable {
    width: 100%;
    box-sizing: border-box;
    .rt-tbody {
      overflow-y: scroll;
      overflow-x: hidden;
    }
  }
  .-pageJump {
    border: solid 1px lightgrey;
    border-radius: 5px;
  }
  .ReactTable .-pagination_button {
    cursor: pointer;
    padding-left: 10px;
    padding-right: 10px;
    color: grey;
    user-select: none;
  }
  .ReactTable .-pagination_button.-current {
    background: lightgrey;
    color: #f0f1f6;
  }
`;
